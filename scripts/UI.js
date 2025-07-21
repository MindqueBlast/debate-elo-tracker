// --- DATE HELPER ---
function getLocalDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- LIFECYCLE & DATA ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

async function loadData() {
    console.log('Fetching data from database...');
    try {
        const { data: debatersData, error: debatersError } =
            await supabaseClient.from('debaters').select('*');
        if (debatersError) throw debatersError;

        const { data: annotationsData, error: annotationsError } =
            await supabaseClient.from('annotations').select('*');
        if (annotationsError) throw annotationsError;
        const { data: practiceRounds } = await supabaseClient
            .from('practice_rounds')
            .select('*');
        const { data: tournaments } = await supabaseClient
            .from('tournaments')
            .select('*, tournament_participants(*)');
        appData.practiceRounds = practiceRounds;
        appData.tournaments = tournaments;
        appData.debaters = debatersData;
        appData.annotations = annotationsData;

        console.log('Data fetched successfully.');
        refreshAllUI();
    } catch (error) {
        console.error('Error fetching data:', error);
        alert(
            'Could not load data from the database. Check the console (F12) for errors and ensure your Supabase URL and Key are correct.'
        );
    }
    populateTournamentDebaterSelect();
}

function handleShowGraduatedChange() {
    refreshAllUI();
}

function refreshAllUI() {
    renderDebaters();
    updateSelects();
    renderChart();
    renderAnnotationsList();
    renderTournaments();
    renderPracticeRounds();
}

// --- UI RENDERING ---
function renderDebaters() {
    const list = document.getElementById('debatersList');
    const showGraduated = document.getElementById('showGraduated').checked;
    list.innerHTML = '';

    const sortedDebaters = [...appData.debaters].sort((a, b) => b.elo - a.elo);

    sortedDebaters.forEach((debater, index) => {
        if (debater.status === 'graduated' && !showGraduated) return;

        const currentRank = index + 1;
        const previousRank = appData.previousRanks[debater.id];
        let arrow = '';
        let rankDiffHTML = '';
        let rankDiffClass = '';

        if (previousRank !== undefined && previousRank !== currentRank) {
            const diff = previousRank - currentRank;
            const isUp = diff > 0;
            arrow = isUp ? '🔺' : '🔻';
            rankDiffClass = isUp ? 'rank-up' : 'rank-down';
            rankDiffHTML = `<span class="rank-diff ${rankDiffClass}">${arrow} (${
                diff > 0 ? '+' : ''
            }${diff})</span>`;
        }

        // Store new rank
        appData.previousRanks[debater.id] = currentRank;

        const li = document.createElement('li');
        li.className = `list-item ${
            debater.status === 'graduated' ? 'graduated' : ''
        }`;
        li.innerHTML = `
            <div class="item-info">
                <span class="rank-number">#${currentRank}</span> ${rankDiffHTML}
                ${debater.name} - <span class="elo-rating">${Math.round(
            debater.elo
        )}</span>
            </div>
            <div class="item-controls">
                <button class="secondary" onclick="setElo('${
                    debater.id
                }')">Set Elo</button>
                <button class="secondary" onclick="toggleGraduate('${
                    debater.id
                }')">
                    ${debater.status === 'active' ? 'Graduate' : 'Activate'}
                </button>
                <button class="danger" onclick="removeDebater('${
                    debater.id
                }')">Remove</button>
            </div>
        `;
        list.appendChild(li);
    });
}

async function renderPracticeRounds() {
    const list = document.getElementById('practiceRoundsList');
    list.innerHTML = '';

    const { data: rounds, error } = await supabaseClient
        .from('practice_rounds')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching practice rounds:', error);
        return;
    }

    const debaterMap = new Map(appData.debaters.map((d) => [d.id, d.name]));

    rounds.forEach((round) => {
        const winnerName = debaterMap.get(round.winner_id) || 'Unknown';
        const loserName = debaterMap.get(round.loser_id) || 'Unknown';

        const li = document.createElement('li');
        li.className = 'list-item';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-info';

        // Winner's Elo change styled green (+)
        const winnerChange = `<span style="color: #4caf50;">+${round.winner_change.toFixed(
            1
        )}</span>`;
        // Loser's Elo change styled red (-)
        const loserChange = `<span style="color: #e74c3c;">${round.loser_change.toFixed(
            1
        )}</span>`;

        infoDiv.innerHTML = `
            <strong>${round.date}</strong>: 
            <span class="elo-rating">${winnerName}</span> def. 
            <span class="elo-rating" style="color:#ff7777;">${loserName}</span>
            <span style="margin-left: 10px; font-style: italic;">
                (${winnerChange} / ${loserChange})
            </span>
        `;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'item-controls';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deletePracticeRound(round.id);

        controlsDiv.appendChild(deleteBtn);

        li.appendChild(infoDiv);
        li.appendChild(controlsDiv);

        list.appendChild(li);
    });
}

async function renderTournaments() {
    const list = document.getElementById('tournamentsList');
    list.innerHTML = '';

    const { data: tournaments, error: tournamentError } = await supabaseClient
        .from('tournaments')
        .select('*')
        .order('date', { ascending: false });

    if (tournamentError) {
        console.error('Failed to fetch tournaments:', tournamentError);
        return;
    }

    for (const tournament of tournaments) {
        // Get participants for this tournament
        const { data: participants, error: partError } = await supabaseClient
            .from('tournament_participants')
            .select('*, debaters(name)')
            .eq('tournament_id', tournament.id);

        if (partError) {
            console.error(
                `Error fetching participants for tournament ${tournament.id}:`,
                partError
            );
            continue;
        }

        const participantList = participants
            .map((p) => {
                const change = p.elo_change.toFixed(1);
                const colorClass =
                    p.elo_change >= 0
                        ? 'style="color:#4caf50;font-weight:bold;"'
                        : 'style="color:#e74c3c;font-weight:bold;"';
                return `<div class="note" style="margin-top:8px;">
                        ${p.debaters.name}: <span ${colorClass}>${
                    change >= 0 ? '+' : ''
                }${change}</span>
                        (Raw Wins: ${
                            p.raw_wins
                        }, Adj: ${p.adjusted_wins.toFixed(2)})


                    </div>`;
            })
            .join('');

        const tournamentCard = `
            <li class="list-item">
                <div class="item-info">
                    <strong>${tournament.name || 'Unnamed Tournament'} — ${
            tournament.date
        }</strong>
                    ${participantList}
                </div>
                <div class="item-controls">
                    <button class="danger" onclick="deleteTournament('${
                        tournament.id
                    }')">Delete</button>
                </div>
            </li>
        `;
        list.innerHTML += tournamentCard;
    }
}

function updateSelects() {
    const showGraduated = document.getElementById('showGraduated').checked;

    const selects = {
        player1: document.getElementById('player1'),
        player2: document.getElementById('player2'),
        analyticsDebater: document.getElementById('analyticsDebater'),
        tournamentAddDebater: document.getElementById('tournamentAddDebater'),
    };

    for (const key in selects) {
        const select = selects[key];
        const currentVal = select.value;
        select.innerHTML = '<option value="">Select a debater...</option>';

        if (key === 'analyticsDebater') {
            const allOption = document.createElement('option');
            allOption.value = 'ALL';
            allOption.textContent = '-- All Debaters --';
            select.appendChild(allOption);
        }

        let sourceList;
        if (key === 'analyticsDebater') {
            sourceList = showGraduated
                ? appData.debaters
                : appData.debaters.filter((d) => d.status === 'active');
        } else {
            sourceList = appData.debaters.filter((d) => d.status === 'active');
        }

        sourceList.forEach((debater) => {
            if (
                key === 'tournamentAddDebater' &&
                tournamentParticipants.has(debater.id)
            )
                return;
            const option = document.createElement('option');
            option.value = debater.id;
            option.textContent = `${debater.name} (${Math.round(debater.elo)})`;
            select.appendChild(option);
        });
        select.value = currentVal;
    }
}

// --- ANNOTATION MANAGEMENT ---
async function addAnnotation() {
    const eventDate = document.getElementById('eventDate').value;
    const eventName = document.getElementById('eventName').value.trim();

    if (!eventDate || !eventName) {
        alert('Please pick a date and enter an event name.');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('annotations')
            .insert({ date: eventDate, name: eventName });
        if (error) throw error;
        document.getElementById('eventName').value = '';
        document.getElementById('eventDate').value = '';
        await loadData();
    } catch (error) {
        console.error('Error adding annotation:', error);
        alert('Failed to add annotation.');
    }
}

async function removeAnnotation(id) {
    if (confirm('Are you sure you want to remove this important date?')) {
        try {
            const { error } = await supabaseClient
                .from('annotations')
                .delete()
                .eq('id', id);
            if (error) throw error;
            await loadData();
        } catch (error) {
            console.error('Error removing annotation:', error);
            alert('Failed to remove annotation.');
        }
    }
}

async function editAnnotationDate(id) {
    const annotation = appData.annotations.find((a) => a.id === id);
    if (!annotation) return;

    const newDateStr = prompt(
        `Enter new date for "${annotation.name}":`,
        annotation.date
    );
    if (newDateStr === null) return;
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(newDateStr) ||
        isNaN(new Date(newDateStr).getTime())
    ) {
        alert('Invalid date format. Please use YYYY-MM-DD.');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('annotations')
            .update({ date: newDateStr })
            .eq('id', id);
        if (error) throw error;
        await loadData();
    } catch (error) {
        console.error('Error editing date:', error);
        alert('Failed to edit date.');
    }
}

function renderAnnotationsList() {
    const list = document.getElementById('annotationsList');
    list.innerHTML = '';
    if (!appData.annotations || appData.annotations.length === 0) {
        list.innerHTML = '<li>No global marked dates.</li>';
        return;
    }

    const sortedAnnotations = [...appData.annotations].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    );

    sortedAnnotations.forEach((annotation) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${annotation.name} (${annotation.date})</span>
            <div class="item-controls" style="gap: 10px;">
                <button class="secondary" style="padding: 2px 8px;" onclick="editAnnotationDate('${annotation.id}')">Edit Date</button>
                <button class="danger" style="padding: 2px 8px;" onclick="removeAnnotation('${annotation.id}')">Remove</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function populateTournamentDebaterSelect() {
    const select = document.getElementById('tournamentAddDebater');
    select.innerHTML = `<option value="">-- Select Debater --</option>`;
    appData.debaters.forEach((d) => {
        select.innerHTML += `<option value="${d.id}">${d.name}</option>`;
    });
}

function addParticipant() {
    const select = document.getElementById('tournamentAddDebater');
    const divisionSelect = document.getElementById('tournamentDivision');
    const debaterId = select.value;

    if (!debaterId) {
        alert('Please select a debater to add.');
        return;
    }
    if (tournamentParticipants.has(debaterId)) {
        alert('This participant is already added.');
        return;
    }

    const debater = appData.debaters.find((d) => d.id === debaterId);
    if (!debater) {
        alert('Selected debater not found.');
        return;
    }

    tournamentParticipants.set(debaterId, {
        ...debater,
        division: divisionSelect.value,
        W_raw: 0, // default raw wins
    });

    renderTournamentParticipants();
}

function renderTournamentParticipants() {
    const list = document.getElementById('tournamentParticipantsList');
    list.innerHTML = '';

    tournamentParticipants.forEach((p) => {
        const li = document.createElement('li');
        li.classList.add('list-item');

        li.innerHTML = `
        <div class="item-info">
          ${p.name} (${p.division})
        </div>
        <div class="item-controls">
          <input type="number" min="0" value="${p.W_raw}" 
                 onchange="updateRawWins('${p.id}', this.value)" 
                 style="width: 60px; margin-right: 10px;" />
          <button class="danger" onclick="removeParticipant('${p.id}')">Remove</button>
        </div>
      `;

        list.appendChild(li);
    });
}

function updateRawWins(id, value) {
    if (tournamentParticipants.has(id)) {
        const participant = tournamentParticipants.get(id);
        participant.W_raw = Number(value);
        tournamentParticipants.set(id, participant);
    }
}

function removeParticipant(id) {
    tournamentParticipants.delete(id);
    renderTournamentParticipants();
}
