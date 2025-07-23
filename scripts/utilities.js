// --- SUPABASE CONNECTION ---
const SUPABASE_URL = 'https://fuxqbiiyrpvpxvyswzyz.supabase.co'; // Paste your Project URL here
const SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1eHFiaWl5cnB2cHh2eXN3enl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjkzOTksImV4cCI6MjA2ODYwNTM5OX0.nMfZW__cQllAKmmCBEWI5rjXFhBGEv1O0gB1p64UKOE'; // Paste your anon public Project API Key here
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- GLOBAL STATE ---
let appData = {
    debaters: [],
    annotations: [],
    previousRanks: {},
};

let tournamentParticipants = new Map();
let eloChart = null;

function toggleFullscreen() {
    const container = document.getElementById('chartContainer');
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch((err) => {
            alert(`Error attempting fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

// --- DATE HELPER ---
function getLocalDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showToast(message, type = 'info', duration = 3000) {
    Toastify({
        text: message,
        duration: duration,
        gravity: 'top',
        position: 'right',
        backgroundColor:
            type === 'success'
                ? 'linear-gradient(to right, #00b09b, #96c93d)'
                : type === 'error'
                ? 'linear-gradient(to right, #e74c3c, #c0392b)'
                : type === 'warning'
                ? 'linear-gradient(to right, #f39c12, #e67e22)'
                : '#444',
        stopOnFocus: true,
        close: true,
    }).showToast();
}

function downloadChartJSON() {
    if (!eloChart || !eloChart.data || !eloChart.data.datasets) {
        alert('Chart data not available.');
        return;
    }

    const exportData = eloChart.data.datasets.map((dataset) => ({
        id: dataset.id || dataset.label,
        name: dataset.label,
        history: dataset.data.map((point) => ({
            date: new Date(point.x).toISOString(),
            elo: Math.round(point.y),
        })),
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart_export.json';
    a.click();
    URL.revokeObjectURL(url);
}

function downloadChartPNG() {
    const canvas = document.getElementById('eloChart');
    if (!canvas) return;

    const link = document.createElement('a');
    const selectedDebaterId = document.getElementById('analyticsDebater').value;
    const filename =
        selectedDebaterId === 'ALL'
            ? 'all_debaters_elo_graph.png'
            : `${getName(selectedDebaterId)}_elo_graph.png`;

    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function loadUploadedChart() {
    const fileInput = document.getElementById('uploadChartJSON');
    if (!fileInput.files.length) {
        alert('Please select a .json file.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const parsedData = JSON.parse(event.target.result);
            const dataArray = Array.isArray(parsedData)
                ? parsedData
                : [parsedData];

            const ctx = document
                .getElementById('uploadedChart')
                .getContext('2d');

            if (window.tempUploadedChart) {
                window.tempUploadedChart.destroy();
            }

            const datasets = dataArray.map((entry, index) => {
                const color = `hsl(${
                    (index * 360) / dataArray.length
                }, 70%, 50%)`;
                return {
                    label: entry.name || `Debater ${index + 1}`,
                    data: (entry.history || []).map((point) => ({
                        x: point.date,
                        y: point.elo,
                    })),
                    borderColor: color,
                    backgroundColor: `${color}1A`,
                    fill: false,
                    tension: 0.1,
                    borderWidth: 1.5,
                };
            });

            window.tempUploadedChart = new Chart(ctx, {
                type: 'line',
                data: { datasets },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        title: {
                            display: true,
                            text: 'Temporary Uploaded Elo Graph',
                            color: '#ddd',
                            font: { size: 16 },
                        },
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: { unit: 'day' },
                            title: {
                                display: true,
                                text: 'Date',
                                color: '#aaa',
                            },
                            ticks: { color: '#aaa' },
                            grid: { color: '#444' },
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Elo Rating',
                                color: '#aaa',
                            },
                            ticks: { color: '#aaa' },
                            grid: { color: '#444' },
                        },
                    },
                },
            });
        } catch (err) {
            alert('Invalid JSON file.');
            console.error('Failed to load uploaded chart:', err);
        }
    };

    reader.readAsText(file);
}
