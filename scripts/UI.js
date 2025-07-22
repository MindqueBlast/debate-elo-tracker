// Full UI.js with viewer-aware logic
let practiceRoundsPage = 1;
const practiceRoundsPerPage = 10;

let tournamentsPage = 1;
const tournamentsPerPage = 5;

async function loadData(isViewer = false) {
    appData.isViewer = isViewer;
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

        if (!appData.isViewer) {
            refreshAllUI();
            populateTournamentDebaterSelect();
        } else {
            renderDebaters(true, 'viewerDebatersList');
            renderChart();
            renderPracticeRounds(practiceRoundsPage);
            renderTournaments(tournamentsPage);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        alert('Could not load data from the database.');
    }
}

function handleShowGraduatedChange() {
    refreshAllUI();
}

function refreshAllUI() {
    renderDebaters(false, 'debatersList');
    updateSelects();
    renderChart();
    renderAnnotationsList();
    practiceRoundsPage = 1;
    tournamentsPage = 1;

    renderPracticeRounds(practiceRoundsPage);
    renderTournaments(tournamentsPage);
}

function renderDebaters(readOnly = false, targetId = 'debatersList') {
    const list = document.getElementById(targetId);
    const showGraduated =
        document.getElementById('showGraduated')?.checked ?? true;
    list.innerHTML = '';

    const activeDebaters = appData.debaters.filter(
        (d) => d.status === 'active'
    );
    const avgElo =
        activeDebaters.length === 0
            ? 0
            : activeDebaters.reduce((sum, d) => sum + d.elo, 0) /
              activeDebaters.length;

    const avgEloBanner = document.createElement('div');
    avgEloBanner.className = 'avg-elo-banner';
    avgEloBanner.textContent = `Average Elo (Active Debaters): ${Math.round(
        avgElo
    )}`;

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
        `;

        if (!readOnly) {
            const controls = document.createElement('div');
            controls.className = 'item-controls';
            controls.innerHTML = `
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
            `;
            li.appendChild(controls);
        }

        list.appendChild(li);
    });

    list.appendChild(avgEloBanner);
}

async function renderPracticeRounds(page = 1) {
    const list = document.getElementById('practiceRoundsList');
    list.innerHTML = '';

    const offset = (page - 1) * practiceRoundsPerPage;

    const { data: rounds, error } = await supabaseClient
        .from('practice_rounds')
        .select('*')
        .order('date', { ascending: false })
        .range(offset, offset + practiceRoundsPerPage - 1);

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

        const winnerChange = `<span style="color: #4caf50;">+${round.winner_change.toFixed(
            1
        )}</span>`;
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

        li.appendChild(infoDiv);

        if (!appData.isViewer) {
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'item-controls';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'danger';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => deletePracticeRound(round.id);

            controlsDiv.appendChild(deleteBtn);
            li.appendChild(controlsDiv);
        }

        list.appendChild(li);
    });

    renderPracticeRoundsPaginationControls(page, rounds.length);
}

async function renderTournaments(page = 1) {
    const list = document.getElementById('tournamentsList');
    list.innerHTML = '';

    const offset = (page - 1) * tournamentsPerPage;

    const { data: tournaments, error: tournamentError } = await supabaseClient
        .from('tournaments')
        .select('*')
        .order('date', { ascending: false })
        .range(offset, offset + tournamentsPerPage - 1);

    if (tournamentError) {
        console.error('Failed to fetch tournaments:', tournamentError);
        return;
    }

    for (const tournament of tournaments) {
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
                ${
                    appData.isViewer
                        ? ''
                        : `<div class="item-controls">
                            <button class="danger" onclick="deleteTournament('${tournament.id}')">Delete</button>
                           </div>`
                }
            </li>
        `;
        list.innerHTML += tournamentCard;
    }

    renderTournamentsPaginationControls(page, tournaments.length);
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
            ${
                appData.isViewer
                    ? ''
                    : `<div class="item-controls" style="gap: 10px;">
                        <button class="secondary" style="padding: 2px 8px;" onclick="editAnnotationDate('${annotation.id}')">Edit Date</button>
                        <button class="danger" style="padding: 2px 8px;" onclick="removeAnnotation('${annotation.id}')">Remove</button>
                    </div>`
            }
        `;
        list.appendChild(li);
    });
}
