let practiceRoundsPage = 1;
const practiceRoundsPerPage = 10;

let tournamentsPage = 1;
const tournamentsPerPage = 3;

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
            renderPracticeRounds(
                practiceRoundsPage,
                'viewerPracticeRoundsList',
                'viewerPracticeRoundsPagination'
            );
            renderTournaments(
                tournamentsPage,
                'viewerTournamentsList',
                'viewerTournamentsPagination'
            );
            updateViewerAnalyticsDebaterSelect();
            renderViewerChart();
            const viewerAnalyticsDebater = document.getElementById(
                'viewerAnalyticsDebater'
            );
            if (
                viewerAnalyticsDebater &&
                !viewerAnalyticsDebater._listenerAdded
            ) {
                viewerAnalyticsDebater.addEventListener(
                    'change',
                    renderViewerChart
                );
                viewerAnalyticsDebater._listenerAdded = true;
            }
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

// --- UI RENDERING ---
function renderDebaters(readOnly = false, targetId = 'debatersList') {
    const list = document.getElementById(targetId);
    list.innerHTML = '';

    let showGraduated = false;
    if (!readOnly) {
        const checkbox = document.getElementById('showGraduated');
        showGraduated = checkbox ? checkbox.checked : false;
    }

    // Add search bar if not present
    let searchId = targetId + 'Search';
    let searchBar = document.getElementById(searchId);
    if (!searchBar) {
        searchBar = document.createElement('input');
        searchBar.type = 'text';
        searchBar.id = searchId;
        searchBar.placeholder = 'Search debaters...';
        searchBar.style =
            'width: 100%; margin-bottom: 10px; padding: 6px 10px; border-radius: 6px; border: 1px solid #444; background: #1e1e1e; color: #eee;';
        // Insert before the list (ul)
        list.parentNode.insertBefore(searchBar, list);
        searchBar.addEventListener('input', () =>
            renderDebaters(readOnly, targetId)
        );
    }
    const searchValue = searchBar.value.trim().toLowerCase();

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

    let sortedDebaters = [...appData.debaters].sort((a, b) => b.elo - a.elo);
    if (searchValue) {
        sortedDebaters = sortedDebaters.filter((d) =>
            d.name.toLowerCase().includes(searchValue)
        );
    }

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
                <span class="debater-link" style="cursor:pointer;" onclick="showDebaterProfile('${
                    debater.id
                }')">${
            debater.name
        }</span> - <span class="elo-rating">${Math.round(debater.elo)}</span>
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

async function renderPracticeRounds(
    page = 1,
    targetId = 'practiceRoundsList',
    paginationId = 'practiceRoundsPagination'
) {
    const list = document.getElementById(targetId);
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

        if (!appData.isViewer && targetId === 'practiceRoundsList') {
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

    renderPracticeRoundsPaginationControls(
        page,
        rounds.length,
        paginationId,
        targetId
    );
}

function renderPracticeRoundsPaginationControls(
    currentPage,
    itemsCount,
    paginationId = 'practiceRoundsPagination',
    targetId = 'practiceRoundsList'
) {
    const container = document.getElementById(paginationId);
    container.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (practiceRoundsPage > 1) {
            practiceRoundsPage--;
            renderPracticeRounds(practiceRoundsPage, targetId, paginationId);
        }
    };

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = itemsCount < practiceRoundsPerPage;
    nextBtn.onclick = () => {
        practiceRoundsPage++;
        renderPracticeRounds(practiceRoundsPage, targetId, paginationId);
    };

    container.appendChild(prevBtn);
    container.appendChild(nextBtn);
}

async function renderTournaments(
    page = 1,
    targetId = 'tournamentsList',
    paginationId = 'tournamentsPagination'
) {
    const list = document.getElementById(targetId);
    list.innerHTML = '';
    // Add search bar if not present
    let searchId = targetId + 'Search';
    let searchBar = document.getElementById(searchId);
    if (!searchBar) {
        searchBar = document.createElement('input');
        searchBar.type = 'text';
        searchBar.id = searchId;
        searchBar.placeholder = 'Search tournaments (name or date)...';
        searchBar.style =
            'width: 100%; margin-bottom: 10px; padding: 6px 10px; border-radius: 6px; border: 1px solid #444; background: #1e1e1e; color: #eee;';
        list.parentNode.insertBefore(searchBar, list);
        searchBar.addEventListener('input', () =>
            renderTournaments(page, targetId, paginationId)
        );
    }
    const searchValue = searchBar.value.trim().toLowerCase();
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

    let filteredTournaments = tournaments;
    if (searchValue) {
        filteredTournaments = tournaments.filter(
            (t) =>
                (t.name && t.name.toLowerCase().includes(searchValue)) ||
                (t.date && t.date.toLowerCase().includes(searchValue))
        );
    }

    for (const tournament of filteredTournaments) {
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
                    <div class="tourney-expected-wins" style="margin-bottom: 4px; font-style: italic; color: #888;">E_tourney: ${(
                        tournament.e_tourney ?? 0
                    ).toFixed(2)}</div>
                    ${participantList}
                </div>
                ${
                    appData.isViewer && targetId !== 'tournamentsList'
                        ? ''
                        : `<div class="item-controls">
                            <button class="danger" onclick="deleteTournament('${tournament.id}')">Delete</button>
                           </div>`
                }
            </li>
        `;
        list.innerHTML += tournamentCard;
    }

    renderTournamentsPaginationControls(
        page,
        filteredTournaments.length,
        paginationId,
        targetId
    );
}

function renderTournamentsPaginationControls(
    currentPage,
    itemsCount,
    paginationId = 'tournamentsPagination',
    targetId = 'tournamentsList'
) {
    const container = document.getElementById(paginationId);
    container.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (tournamentsPage > 1) {
            tournamentsPage--;
            renderTournaments(tournamentsPage, targetId, paginationId);
        }
    };

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = itemsCount < tournamentsPerPage;
    nextBtn.onclick = () => {
        tournamentsPage++;
        renderTournaments(tournamentsPage, targetId, paginationId);
    };

    container.appendChild(prevBtn);
    container.appendChild(nextBtn);
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
    prelim_wins: 0,
    elim_wins: 0,
    W_raw: 0,
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
  <div class="item-info" style="align-self: center;">
    ${p.name} (${p.division})
  </div>
  <div class="item-controls" style="display: flex; align-items: center; gap: 5px;">
    <label style="color:#ccc;">Prelim</label>
    <input type="number" min="0" value="${p.prelim_wins}" 
           onchange="updateWins('${p.id}', 'prelim', this.value)"
           style="width: 50px;" />
    <label style="color:#ccc;">Elim</label>
    <input type="number" min="0" value="${p.elim_wins}" 
           onchange="updateWins('${p.id}', 'elim', this.value)"
           style="width: 50px;" />
    <span style="margin-left: 10px; color:#9fc;">Raw: ${p.W_raw}</span>
    <button class="danger">Remove</button>
  </div>
`;


        li.querySelector('button').addEventListener('click', () =>
            removeParticipant(p.id)
        );
        list.appendChild(li);
    });
}

function updateWins(id, type, value) {
    if (!tournamentParticipants.has(id)) return;
    const participant = tournamentParticipants.get(id);
    const numericValue = Math.max(0, Number(value));
    if (type === 'prelim') participant.prelim_wins = numericValue;
    else if (type === 'elim') participant.elim_wins = numericValue;
    participant.W_raw = participant.prelim_wins + 2 * participant.elim_wins;
    tournamentParticipants.set(id, participant);
    renderTournamentParticipants(); // re-render to update displayed raw
}


function removeParticipant(id) {
    tournamentParticipants.delete(id);
    renderTournamentParticipants();
}

function updateExpectedScore() {
    const winnerId = document.getElementById('player1').value;
    const loserId = document.getElementById('player2').value;

    if (!winnerId || !loserId || winnerId === loserId) {
        document.getElementById('expectedScoreDisplay').textContent =
            'Expected score: —';
        return;
    }

    const a = appData.debaters.find((d) => d.id === winnerId);
    const b = appData.debaters.find((d) => d.id === loserId);

    if (!a || !b) {
        document.getElementById('expectedScoreDisplay').textContent =
            'Expected score: —';
        return;
    }

    const elo_a = a.elo;
    const elo_b = b.elo;

    const E = 1 / (1 + Math.pow(10, (elo_b - elo_a) / 400));

    // Show as percentage with 1 decimal place
    document.getElementById(
        'expectedScoreDisplay'
    ).textContent = `Win Probability for ${a.name}: ${(E * 100).toFixed(1)}%`;
}

// Add event listeners on the selects to update live
document
    .getElementById('player1')
    .addEventListener('change', updateExpectedScore);
document
    .getElementById('player2')
    .addEventListener('change', updateExpectedScore);
function renderViewerDebaters() {
    const list = document.getElementById('viewerDebatersList');
    list.innerHTML = '';
    // Add search bar if not present
    let searchId = 'viewerDebatersListSearch';
    let searchBar = document.getElementById(searchId);
    if (!searchBar) {
        searchBar = document.createElement('input');
        searchBar.type = 'text';
        searchBar.id = searchId;
        searchBar.placeholder = 'Search debaters...';
        searchBar.style =
            'width: 100%; margin-bottom: 10px; padding: 6px 10px; border-radius: 6px; border: 1px solid #444; background: #1e1e1e; color: #eee;';
        list.parentNode.insertBefore(searchBar, list);
        searchBar.addEventListener('input', renderViewerDebaters);
    }
    const searchValue = searchBar.value.trim().toLowerCase();
    const sorted = [...appData.debaters].sort((a, b) => b.elo - a.elo);
    let filtered = sorted.filter((d) => d.status === 'active');
    if (searchValue) {
        filtered = filtered.filter((d) =>
            d.name.toLowerCase().includes(searchValue)
        );
    }
    filtered.forEach((d, i) => {
        if (d.status === 'graduated') return;
        const li = document.createElement('li');
        li.innerHTML = `#${
            i + 1
        } — <span class="debater-link" style="color:#4e9cff;cursor:pointer;text-decoration:underline;" onclick="showDebaterProfile('${
            d.id
        }')">${d.name}</span> (${Math.round(d.elo)})`;
        list.appendChild(li);
    });
}

function updateViewerAnalyticsDebaterSelect() {
    const select = document.getElementById('viewerAnalyticsDebater');
    if (!select) return;
    select.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = '-- All Debaters --';
    select.appendChild(allOption);
    appData.debaters
        .filter((d) => d.status === 'active')
        .forEach((debater) => {
            const option = document.createElement('option');
            option.value = debater.id;
            option.textContent = `${debater.name} (${Math.round(debater.elo)})`;
            select.appendChild(option);
        });
    select.value = 'ALL';
}

// --- MODAL LOGIC ---
function showDebaterProfile(debaterId) {
    const debater = appData.debaters.find((d) => d.id === debaterId);
    if (!debater) return;
    let modal = document.getElementById('debaterProfileModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'debaterProfileModal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '99999';
        modal.innerHTML = `
            <div id="debaterProfileContent" style="background:#222;padding:32px 24px 24px 24px;border-radius:16px;min-width:320px;max-width:90vw;max-height:90vh;overflow:auto;box-shadow:0 8px 32px #000a;position:relative;">
                <button id="closeDebaterProfile" style="position:absolute;top:12px;right:12px;font-size:20px;background:none;border:none;color:#fff;cursor:pointer;">&times;</button>
                <h2 id="debaterProfileName"></h2>
                <div id="debaterProfileElo" style="font-size:1.2em;margin-bottom:16px;"></div>
                <div id="debaterProfileStatus" style="margin-bottom:8px;"></div>
                <canvas id="debaterProfileChart" width="320" height="160"></canvas>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
        document.getElementById('closeDebaterProfile').onclick = () => {
            modal.style.display = 'none';
        };
    } else {
        modal.style.display = 'flex';
    }
    document.getElementById('debaterProfileName').textContent = debater.name;
    document.getElementById(
        'debaterProfileStatus'
    ).textContent = `Status: ${debater.status}`;
    document.getElementById(
        'debaterProfileElo'
    ).textContent = `Current Elo: ${Math.round(debater.elo)}`;
    // Calculate winrate (practice rounds only)
    const practiceRounds = appData.practiceRounds || [];
    const wins = practiceRounds.filter(
        (r) => r.winner_id === debater.id
    ).length;
    const played = practiceRounds.filter(
        (r) => r.winner_id === debater.id || r.loser_id === debater.id
    ).length;
    let winrateText = '';
    if (played > 0) {
        const winrate = (wins / played) * 100;
        winrateText = `PR Winrate: ${wins} / ${played} (${winrate.toFixed(
            1
        )}%)`;
    } else {
        winrateText = 'PR Winrate: N/A';
    }
    // Insert winrate below Elo
    document
        .getElementById('debaterProfileElo')
        .insertAdjacentHTML(
            'afterend',
            `<div id="debaterProfileWinrate" style="margin-bottom:16px;">${winrateText}</div>`
        );
    // Mini Elo chart
    const ctx = document.getElementById('debaterProfileChart').getContext('2d');
    if (window.debaterProfileChartInstance)
        window.debaterProfileChartInstance.destroy();
    const history = debater.history || [];
    window.debaterProfileChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map((h) => h.date),
            datasets: [
                {
                    label: 'Elo',
                    data: history.map((h) => h.elo),
                    borderColor: '#4e9cff',
                    backgroundColor: 'rgba(78,156,255,0.1)',
                    fill: true,
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2.5,
                },
            ],
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { display: true, title: { display: false } },
            },
        },
    });
}
