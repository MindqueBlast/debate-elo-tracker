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
    console.log("Fetching data from database...");
    try {
        const { data: debatersData, error: debatersError } = await supabaseClient.from('debaters').select('*');
        if (debatersError) throw debatersError;
        
        const { data: annotationsData, error: annotationsError } = await supabaseClient.from('annotations').select('*');
        if (annotationsError) throw annotationsError;

        appData.debaters = debatersData;
        appData.annotations = annotationsData;
        
        console.log("Data fetched successfully.");
        refreshAllUI();
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Could not load data from the database. Check the console (F12) for errors and ensure your Supabase URL and Key are correct.");
    }
}

function handleShowGraduatedChange() {
    refreshAllUI();
}

function refreshAllUI() {
    renderDebaters();
    updateSelects();
    renderChart();
    renderAnnotationsList();
}


// --- UI RENDERING ---
function renderDebaters() {
    const list = document.getElementById('debatersList');
    const showGraduated = document.getElementById('showGraduated').checked;
    list.innerHTML = '';
    const sortedDebaters = [...appData.debaters].sort((a, b) => b.elo - a.elo);
    
    sortedDebaters.forEach(debater => {
        if (debater.status === 'graduated' && !showGraduated) return;
        const li = document.createElement('li');
        li.className = `list-item ${debater.status === 'graduated' ? 'graduated' : ''}`;
        li.innerHTML = `
            <div class="item-info">${debater.name} - <span class="elo-rating">${Math.round(debater.elo)}</span></div>
            <div class="item-controls">
                <button class="secondary" onclick="setElo('${debater.id}')">Set Elo</button>
                <button class="secondary" onclick="toggleGraduate('${debater.id}')">${debater.status === 'active' ? 'Graduate' : 'Activate'}</button>
                <button class="danger" onclick="removeDebater('${debater.id}')">Remove</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function updateSelects() {
    const showGraduated = document.getElementById('showGraduated').checked;
    
    const selects = {
        player1: document.getElementById('player1'),
        player2: document.getElementById('player2'),
        analyticsDebater: document.getElementById('analyticsDebater'),
        tournamentAddDebater: document.getElementById('tournamentAddDebater')
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
            sourceList = showGraduated ? appData.debaters : appData.debaters.filter(d => d.status === 'active');
        } else {
            sourceList = appData.debaters.filter(d => d.status === 'active');
        }
        
        sourceList.forEach(debater => {
            if (key === 'tournamentAddDebater' && tournamentParticipants.has(debater.id)) return;
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

    if (!eventDate || !eventName) { alert('Please pick a date and enter an event name.'); return; }

    try {
        const { error } = await supabaseClient.from('annotations').insert({ date: eventDate, name: eventName });
        if (error) throw error;
        document.getElementById('eventName').value = '';
        document.getElementById('eventDate').value = '';
        await loadData();
    } catch (error) {
        console.error("Error adding annotation:", error);
        alert("Failed to add annotation.");
    }
}

async function removeAnnotation(id) {
    if (confirm("Are you sure you want to remove this important date?")) {
        try {
            const { error } = await supabaseClient.from('annotations').delete().eq('id', id);
            if (error) throw error;
            await loadData();
        } catch (error) {
            console.error("Error removing annotation:", error);
            alert("Failed to remove annotation.");
        }
    }
}

async function editAnnotationDate(id) {
    const annotation = appData.annotations.find(a => a.id === id);
    if (!annotation) return;
    
    const newDateStr = prompt(`Enter new date for "${annotation.name}":`, annotation.date);
    if (newDateStr === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateStr) || isNaN(new Date(newDateStr).getTime())) {
        alert("Invalid date format. Please use YYYY-MM-DD.");
        return;
    }

    try {
        const { error } = await supabaseClient.from('annotations').update({ date: newDateStr }).eq('id', id);
        if (error) throw error;
        await loadData();
    } catch (error) {
        console.error("Error editing date:", error);
        alert("Failed to edit date.");
    }
}

function renderAnnotationsList() {
    const list = document.getElementById('annotationsList');
    list.innerHTML = '';
    if (!appData.annotations || appData.annotations.length === 0) {
        list.innerHTML = '<li>No global marked dates.</li>';
        return;
    }

    const sortedAnnotations = [...appData.annotations].sort((a,b) => new Date(a.date) - new Date(b.date));

    sortedAnnotations.forEach(annotation => {
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