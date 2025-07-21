// --- CALCULATIONS ---
async function recordPracticeRound() {
    const winnerId = document.getElementById('player1').value;
    const loserId = document.getElementById('player2').value;
    if (!winnerId || !loserId || winnerId === loserId) {
        alert('Please select two different debaters.');
        return;
    }

    const a = appData.debaters.find((d) => d.id === winnerId);
    const b = appData.debaters.find((d) => d.id === loserId);
    if (!a || !b) {
        alert('Could not find one of the debaters.');
        return;
    }

    const elo_a = a.elo;
    const elo_b = b.elo;
    const E = 1 / (1 + Math.pow(10, (elo_b - elo_a) / 400));
    const B_a = 15 * (1 - E);
    const B_b = 15 * E;
    const C_a = 100 * (1 - E);
    const C_b = -C_a;
    const new_elo_a = elo_a + C_a + B_a;
    const new_elo_b = elo_b + C_b + B_b;
    const today = getLocalDateString();

    const newHistoryA = [
        ...(a.history || []),
        {
            date: today,
            elo: new_elo_a,
        },
    ];
    const newHistoryB = [
        ...(b.history || []),
        {
            date: today,
            elo: new_elo_b,
        },
    ];

    const winner_change = new_elo_a - elo_a;
    const loser_change = new_elo_b - elo_b;

    try {
        // Update debaters' Elo
        const { error: errorA } = await supabaseClient
            .from('debaters')
            .update({ elo: new_elo_a, history: newHistoryA })
            .eq('id', a.id);
        if (errorA) throw errorA;

        const { error: errorB } = await supabaseClient
            .from('debaters')
            .update({ elo: new_elo_b, history: newHistoryB })
            .eq('id', b.id);
        if (errorB) throw errorB;

        // **INSERT the practice round record**
        const { error: insertError } = await supabaseClient
            .from('practice_rounds')
            .insert([
                {
                    date: getLocalDateString(),
                    winner_id: a.id,
                    loser_id: b.id,
                    winner_change: new_elo_a - elo_a,
                    loser_change: new_elo_b - elo_b,
                },
            ]);
        if (insertError) throw insertError;

        alert('Practice round recorded successfully!');

        document.getElementById('matchForm').reset();
        await loadData();
    } catch (error) {
        console.error('Error saving practice round and Elo update:', error);
        alert('Failed to save match results.');
    }
}

async function recordTournament() {
    const n = parseInt(document.getElementById('tournamentRounds').value, 10);
    const b = parseFloat(document.getElementById('tournamentBonus').value);
    const k = parseFloat(
        document.getElementById('tournamentAffectValue').value
    );
    const maxGain = parseFloat(
        document.getElementById('tournamentMaxGain').value
    );
    const tournamentName = document
        .getElementById('tournamentName')
        .value.trim();
    const maxRoundsInput = document
        .getElementById('tournamentMaxRounds')
        .value.trim();
    const maxRounds =
        maxRoundsInput === '' ? null : parseInt(maxRoundsInput, 10);

    // Validation only if not null
    if (maxRounds !== null && (isNaN(maxRounds) || maxRounds < 0)) {
        alert('Please enter a valid Max Rounds value or leave it empty.');
        return;
    }

    if (isNaN(maxRounds) || maxRounds < 0) {
        alert('Please enter a valid Max Rounds value.');
        return;
    }
    if (isNaN(n) || n <= 0) {
        alert('Please enter a valid number of rounds (n).');
        return;
    }
    if (isNaN(b)) {
        alert('Please enter a valid tournament bonus (b).');
        return;
    }
    if (isNaN(k)) {
        alert('Please enter a valid affect value (k).');
        return;
    }
    if (isNaN(maxGain) || maxGain < 0) {
        alert('Please enter a valid max Elo gain.');
        return;
    }
    if (tournamentParticipants.size < 1) {
        alert('Please add at least one participant.');
        return;
    }

    const participants = Array.from(tournamentParticipants.values());
    if (participants.some((p) => p.W_raw === undefined || p.W_raw < 0)) {
        alert('Please enter valid raw wins for every participant.');
        return;
    }

    const t = participants.length;
    const activeDebaters = appData.debaters.filter(
        (d) => d.status === 'active'
    );
    if (activeDebaters.length === 0) {
        alert(
            'There are no active debaters on the roster to calculate an average Elo.'
        );
        return;
    }
    const e_avg =
        activeDebaters.reduce((sum, d) => sum + d.elo, 0) /
        activeDebaters.length;

    let s = 0;
    participants.forEach((p) => {
        const W_raw = p.W_raw;
        let W_adjusted;
        if (p.division === 'Novice') {
            W_adjusted = W_raw;
        } else {
            const win_percent = n > 0 ? (W_raw / n) * 100 : 0;
            W_adjusted =
                p.division === 'JV'
                    ? ((-200 / (win_percent + 6.7) + 30) / 100) * n + W_raw
                    : ((-200 / (win_percent + 4) + 50) / 100) * n + W_raw;
        }
        p.W_adjusted = W_adjusted;
        s += p.W_adjusted;
    });

    const E_tourney = (s + (3 * n) / 2) / (t + 3);

    let results = [];
    participants.forEach((p) => {
        const p_prop = Math.pow(p.elo / e_avg, 2);
        let C = k * (p.W_adjusted / p_prop - E_tourney) + b;

        // Only apply maxRounds no-loss rule if maxRounds is valid
        if (maxRounds !== null && p.W_raw === maxRounds && C < 0) {
            C = 0;
        }

        if (C > maxGain) {
            C = maxGain;
        }

        results.push({
            id: p.id,
            name: p.name,
            oldElo: p.elo,
            newElo: p.elo + C,
            change: C,
            W_adjusted: p.W_adjusted,
            p_value: p_prop,
            W_raw: p.W_raw,
            division: p.division,
        });
    });

    const today = getLocalDateString();

    try {
        // Insert tournament info and get its ID
        const { data: insertedTournament, error: insertTournamentError } =
            await supabaseClient
                .from('tournaments')
                .insert([{ date: today, name: tournamentName }])
                .select()
                .single();

        if (insertTournamentError) throw insertTournamentError;

        // Update debaters Elo and histories, and prepare participants rows
        const participantInserts = [];
        const debaterUpdates = [];

        for (const res of results) {
            const debater = appData.debaters.find((d) => d.id === res.id);
            const newHistory = [
                ...(debater.history || []),
                {
                    date: today,
                    elo: res.newElo,
                    event: 'Tournament',
                },
            ];
            debaterUpdates.push(
                supabaseClient
                    .from('debaters')
                    .update({
                        elo: res.newElo,
                        history: newHistory,
                    })
                    .eq('id', res.id)
            );

            participantInserts.push({
                tournament_id: insertedTournament.id,
                debater_id: res.id,
                raw_wins: res.W_raw,
                adjusted_wins: res.W_adjusted,
                elo_change: res.change,
                division: res.division,
            });
        }

        // Run all debater Elo updates
        const updateResponses = await Promise.all(debaterUpdates);
        for (const response of updateResponses) {
            if (response.error) throw response.error;
        }

        // Insert tournament participants
        const { error: participantsInsertError } = await supabaseClient
            .from('tournament_participants')
            .insert(participantInserts);

        if (participantsInsertError) throw participantsInsertError;

        const resultsText =
            `Tournament Results:\n\nOverall Expected Wins (E_tourney): ${E_tourney.toFixed(
                3
            )}\n\n` +
            results
                .map(
                    (r) =>
                        `${r.name}: ${Math.round(r.oldElo)} -> ${Math.round(
                            r.newElo
                        )}\n` +
                        `  Total Change: ${
                            r.change > 0 ? '+' : ''
                        }${r.change.toFixed(1)} (W_adj: ${r.W_adjusted.toFixed(
                            2
                        )}, P-val: ${r.p_value.toFixed(2)})`
                )
                .join('\n\n');
        alert(resultsText);

        tournamentParticipants.clear();
        document.getElementById('tournamentRounds').value = '';
        document.getElementById('tournamentBonus').value = '';
        document.getElementById('tournamentName').value = '';
        renderTournamentParticipants();

        await loadData();
    } catch (error) {
        console.error('Error recording tournament:', error);
        alert('Failed to record tournament results.');
    }
}

async function deletePracticeRound(roundId) {
    const { data: round, error } = await supabaseClient
        .from('practice_rounds')
        .select('*')
        .eq('id', roundId)
        .single();
    if (error || !round) {
        alert('Could not find practice round.');
        return;
    }
    if (
        !confirm(
            'Are you sure you want to delete this practice round and undo its Elo changes?'
        )
    )
        return;

    const winner = appData.debaters.find((d) => d.id === round.winner_id);
    const loser = appData.debaters.find((d) => d.id === round.loser_id);

    if (!winner || !loser) return alert('Could not find both debaters.');

    const newEloWinner = winner.elo - round.winner_change;
    const newEloLoser = loser.elo - round.loser_change;

    try {
        await Promise.all([
            supabaseClient
                .from('debaters')
                .update({ elo: newEloWinner })
                .eq('id', winner.id),
            supabaseClient
                .from('debaters')
                .update({ elo: newEloLoser })
                .eq('id', loser.id),
            supabaseClient.from('practice_rounds').delete().eq('id', roundId),
        ]);
        alert('Practice round deleted and ELO changes reverted.');
        await loadData();
        renderPracticeRounds();
    } catch (err) {
        console.error('Failed to delete practice round:', err);
        alert('Failed to delete and undo changes.');
    }
}

// --- MANAGE TOURNAMENTS ---

async function deleteTournament(tournamentId) {
    const { data: participants, error } = await supabaseClient
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId);

    if (error) {
        alert('Error fetching tournament participants: ' + error.message);
        return;
    }
    if (!participants.length) {
        alert('No participants found for this tournament.');
        return;
    }

    if (
        !confirm(
            'Are you sure you want to delete this tournament and revert Elo changes for all participants?'
        )
    ) {
        return;
    }

    // 1. Undo Elo changes for all participants
    for (const p of participants) {
        const debater = appData.debaters.find((d) => d.id === p.debater_id);
        if (!debater) {
            alert(`Could not find debater with id ${p.debater_id}`);
            return;
        }
        const newElo = debater.elo - p.elo_change;
        const { error: eloError } = await supabaseClient
            .from('debaters')
            .update({ elo: newElo })
            .eq('id', debater.id);

        if (eloError) {
            alert('Failed to revert Elo for a debater: ' + eloError.message);
            return;
        }
    }

    // 2. Delete tournament participants
    const { error: participantsDeleteError } = await supabaseClient
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournamentId);

    if (participantsDeleteError) {
        alert(
            'Failed to delete tournament participants: ' +
                participantsDeleteError.message
        );
        return;
    }

    // 3. Delete the tournament itself
    const { error: tournamentDeleteError } = await supabaseClient
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

    if (tournamentDeleteError) {
        alert('Failed to delete tournament: ' + tournamentDeleteError.message);
        return;
    }

    alert('Tournament deleted and ELO changes reverted.');
    await loadData();
    renderTournaments();
}
