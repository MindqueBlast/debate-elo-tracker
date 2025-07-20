// --- CALCULATIONS ---
async function recordPracticeRound() {
    const winnerId = document.getElementById('player1').value;
    const loserId = document.getElementById('player2').value;
    if (!winnerId || !loserId || winnerId === loserId) {
        alert('Please select two different debaters.');
        return;
    }

    const a = appData.debaters.find(d => d.id === winnerId);
    const b = appData.debaters.find(d => d.id === loserId);
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

    const newHistoryA = [...(a.history || []), {
        date: today,
        elo: new_elo_a
    }];
    const newHistoryB = [...(b.history || []), {
        date: today,
        elo: new_elo_b
    }];

    try {
        const {
            error: errorA
        } = await supabaseClient.from('debaters').update({
            elo: new_elo_a,
            history: newHistoryA
        }).eq('id', a.id);
        if (errorA) throw errorA;
        const {
            error: errorB
        } = await supabaseClient.from('debaters').update({
            elo: new_elo_b,
            history: newHistoryB
        }).eq('id', b.id);
        if (errorB) throw errorB;

        alert(
            `1v1 Round Results:\n\n` +
            `Expected Win Chance (E): ${E.toFixed(4)}\n\n` +
            `${a.name} (Winner):\n` +
            `  Old Elo: ${Math.round(elo_a)}\n` +
            `  Main Change (C): +${C_a.toFixed(2)}\n` +
            `  Bonus (B): +${B_a.toFixed(2)}\n` +
            `  New Elo: ${Math.round(new_elo_a)} (Total: +${(new_elo_a - elo_a).toFixed(2)})\n\n` +
            `${b.name} (Loser):\n` +
            `  Old Elo: ${Math.round(elo_b)}\n` +
            `  Main Change (C): ${C_b.toFixed(2)}\n` +
            `  Bonus (B): +${B_b.toFixed(2)}\n` +
            `  New Elo: ${Math.round(new_elo_b)} (Total: ${(new_elo_b - elo_b).toFixed(2)})`
        );
        document.getElementById('matchForm').reset();
        await loadData();
    } catch (error) {
        console.error("Error updating Elo after practice round:", error);
        alert("Failed to save match results.");
    }
}

async function recordTournament() {
    const n = parseInt(document.getElementById('tournamentRounds').value, 10);
    const b = parseFloat(document.getElementById('tournamentBonus').value);
    const k = parseFloat(document.getElementById('tournamentAffectValue').value);
    const maxGain = parseFloat(document.getElementById('tournamentMaxGain').value);
    const tournamentName = document.getElementById('tournamentName').value.trim();

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
    if (participants.some(p => p.W_raw === undefined || p.W_raw < 0)) {
        alert('Please enter valid raw wins for every participant.');
        return;
    }

    const t = participants.length;
    const activeDebaters = appData.debaters.filter(d => d.status === 'active');
    if (activeDebaters.length === 0) {
        alert("There are no active debaters on the roster to calculate an average Elo.");
        return;
    }
    const e_avg = activeDebaters.reduce((sum, d) => sum + d.elo, 0) / activeDebaters.length;

    let s = 0;
    participants.forEach(p => {
        const W_raw = p.W_raw;
        let W_adjusted;
        if (p.division === 'Novice') {
            W_adjusted = W_raw;
        } else {
            const win_percent = n > 0 ? (W_raw / n) * 100 : 0;
            W_adjusted = p.division === 'JV' ?
                (((-200 / (win_percent + 6.7)) + 30) / 100) * n + W_raw :
                (((-200 / (win_percent + 4)) + 50) / 100) * n + W_raw;
        }
        p.W_adjusted = W_adjusted;
        s += p.W_adjusted;
    });

    const E_tourney = (s + (3 * n / 2)) / (t + 3);

    let results = [];
    participants.forEach(p => {
        const p_prop = Math.pow((p.elo / e_avg), 2);
        let C = k * ((p.W_adjusted / p_prop) - E_tourney) + b;
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
            p_value: p_prop
        });
    });

    const today = getLocalDateString();

    try {
        if (tournamentName) {
            const {
                error
            } = await supabaseClient.from('annotations').insert({
                date: today,
                name: tournamentName
            });
            if (error) throw error;
        }

        const updates = results.map(res => {
            const debater = appData.debaters.find(d => d.id === res.id);
            const newHistory = [...(debater.history || []), {
                date: today,
                elo: res.newElo,
                event: 'Tournament'
            }];
            return supabaseClient.from('debaters').update({
                elo: res.newElo,
                history: newHistory
            }).eq('id', res.id);
        });

        const responses = await Promise.all(updates);
        for (const response of responses) {
            if (response.error) throw response.error;
        }

        const resultsText = `Tournament Results:\n\nOverall Expected Wins (E_tourney): ${E_tourney.toFixed(3)}\n\n` +
            results.map(r =>
                `${r.name}: ${Math.round(r.oldElo)} -> ${Math.round(r.newElo)}\n` +
                `  Total Change: ${r.change > 0 ? '+' : ''}${r.change.toFixed(1)} (W_adj: ${r.W_adjusted.toFixed(2)}, P-val: ${r.p_value.toFixed(2)})`
            ).join('\n\n');
        alert(resultsText);

        tournamentParticipants.clear();
        document.getElementById('tournamentRounds').value = '';
        document.getElementById('tournamentBonus').value = '';
        document.getElementById('tournamentName').value = '';
        renderTournamentParticipants();

        await loadData();
    } catch (error) {
        console.error("Error recording tournament:", error);
        alert("Failed to record tournament results.");
    }
}