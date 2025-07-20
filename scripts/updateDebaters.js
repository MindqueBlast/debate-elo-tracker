// --- DEBATER MANAGEMENT ---
async function addDebater() {
    const nameInput = document.getElementById('debaterName');
    const eloInput = document.getElementById('debaterElo');
    const name = nameInput.value.trim();
    const startElo = parseFloat(eloInput.value) || 1500;

    if (!name) { alert('Please enter a name.'); return; }
    if (appData.debaters.some(d => d.name.toLowerCase() === name.toLowerCase())) { alert('A debater with this name already exists.'); return; }

    const newDebater = {
        name: name,
        elo: startElo,
        status: 'active',
        graduation_date: null,
        history: [{ date: getLocalDateString(), elo: startElo }]
    };

    try {
        const { error } = await supabaseClient.from('debaters').insert(newDebater);
        if (error) throw error;
        nameInput.value = '';
        await loadData();
    } catch (error) {
        console.error("Error adding debater:", error);
        alert("Failed to add debater.");
    }
}

async function removeDebater(id) {
    if (confirm('Are you sure you want to permanently remove this debater and all their data?')) {
        try {
            const { error } = await supabaseClient.from('debaters').delete().eq('id', id);
            if (error) throw error;
            tournamentParticipants.delete(id);
            await loadData();
        } catch(error) {
            console.error("Error removing debater:", error);
            alert("Failed to remove debater.");
        }
    }
}

async function toggleGraduate(id) {
    const debater = appData.debaters.find(d => d.id === id);
    if (debater) {
        const newStatus = debater.status === 'active' ? 'graduated' : 'active';
        const newGraduationDate = newStatus === 'graduated' ? getLocalDateString() : null;

        try {
            const { error } = await supabaseClient.from('debaters').update({ status: newStatus, graduation_date: newGraduationDate }).eq('id', id);
            if (error) throw error;
            await loadData();
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status.");
        }
    }
}

async function setElo(id) {
    const debater = appData.debaters.find(d => d.id === id);
    if (!debater) return;

    const currentElo = Math.round(debater.elo);
    const newEloStr = prompt(`Enter new Elo for ${debater.name}:`, currentElo);

    if (newEloStr === null) return; 

    const newElo = parseFloat(newEloStr);
    if (isNaN(newElo)) { alert("Invalid input. Please enter a number."); return; }

    const newHistory = [...(debater.history || []), { date: getLocalDateString(), elo: newElo, event: 'Manual Adjustment' }];

    try {
        const { error } = await supabaseClient.from('debaters').update({ elo: newElo, history: newHistory }).eq('id', id);
        if (error) throw error;
        await loadData();
    } catch (error) {
        console.error("Error setting Elo:", error);
        alert("Failed to set Elo.");
    }
}