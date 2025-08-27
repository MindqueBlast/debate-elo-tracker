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

// Put this near the top of the file (or before any fullscreen use)
function _savePreFullscreenState(container, canvas) {
    if (container.dataset._preFs) return; // already saved
    const rect = container.getBoundingClientRect();
    const saved = {
        container: {
            width: container.style.width || null,
            height: container.style.height || null,
            display: container.style.display || null,
            alignItems: container.style.alignItems || null,
            justifyContent: container.style.justifyContent || null,
            backgroundColor: container.style.backgroundColor || null,
            computedWidth: `${Math.round(rect.width)}px`,
            computedHeight: `${Math.round(rect.height)}px`,
        },
        canvas: {
            widthStyle: canvas.style.width || null,
            heightStyle: canvas.style.height || null,
            widthAttr: canvas.getAttribute('width') || null,
            heightAttr: canvas.getAttribute('height') || null,
        },
    };
    container.dataset._preFs = JSON.stringify(saved);
}

function _restorePreFullscreenState(container, canvas) {
    if (!container.dataset._preFs) return;
    try {
        const saved = JSON.parse(container.dataset._preFs);

        // Restore container inline styles (fall back to computed pixel size if necessary)
        container.style.width =
            saved.container.width ?? saved.container.computedWidth ?? '';
        container.style.height =
            saved.container.height ?? saved.container.computedHeight ?? '';
        container.style.display = saved.container.display ?? '';
        container.style.alignItems = saved.container.alignItems ?? '';
        container.style.justifyContent = saved.container.justifyContent ?? '';
        container.style.backgroundColor = saved.container.backgroundColor ?? '';

        // Restore canvas inline styles / attributes
        canvas.style.width = saved.canvas.widthStyle ?? '';
        canvas.style.height = saved.canvas.heightStyle ?? '';
        if (saved.canvas.widthAttr)
            canvas.setAttribute('width', saved.canvas.widthAttr);
        else canvas.removeAttribute('width');
        if (saved.canvas.heightAttr)
            canvas.setAttribute('height', saved.canvas.heightAttr);
        else canvas.removeAttribute('height');

        // Resize Chart immediately
        setTimeout(() => {
            if (typeof eloChart !== 'undefined' && eloChart) {
                try {
                    eloChart.resize();
                } catch (e) {
                    /* ignore */
                }
            }
            // Clear pixel-locked inline sizes after the resize so layout returns to responsive behavior.
            // We do this only if the original inline style was null (i.e., we used computedWidth as fallback).
            if (!saved.container.width)
                container.style.width = saved.container.width ?? '';
            if (!saved.container.height)
                container.style.height = saved.container.height ?? '';
        }, 60);
    } catch (err) {
        console.error('Failed to restore fullscreen state:', err);
    } finally {
        delete container.dataset._preFs;
    }
}

// Replace your toggleFullscreen with this version:
function toggleFullscreen() {
    const container = document.getElementById('chartContainer');
    const canvas = document.getElementById('eloChart');
    if (!container || !canvas) return;

    if (!document.fullscreenElement) {
        // Save previous state (inline styles + computed size) so we can restore later
        _savePreFullscreenState(container, canvas);

        // Request fullscreen then apply styles
        container
            .requestFullscreen()
            .then(() => {
                container.style.width = '100vw';
                container.style.height = '100vh';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.backgroundColor = '#1e1e1e';

                // Ensure canvas fills the container visually
                canvas.style.width = '100%';
                canvas.style.height = '100%';

                // Let Chart.js re-layout
                setTimeout(() => {
                    if (typeof eloChart !== 'undefined' && eloChart) {
                        try {
                            eloChart.resize();
                        } catch (e) {
                            /* ignore */
                        }
                    }
                }, 100);
            })
            .catch((err) => {
                alert(`Error attempting fullscreen: ${err.message}`);
            });
    } else {
        // exit — just call exitFullscreen; actual restoration happens on fullscreenchange
        document.exitFullscreen().catch((err) => {
            console.warn('exitFullscreen failed:', err);
            // attempt manual restore if exitFullscreen fails
            _restorePreFullscreenState(container, canvas);
        });
    }
}

// Make sure we also restore if the user exits fullscreen by other means (Esc / X)
document.addEventListener('fullscreenchange', () => {
    const container = document.getElementById('chartContainer');
    const canvas = document.getElementById('eloChart');
    if (!container || !canvas) return;

    // When fullscreen is gone, restore
    if (!document.fullscreenElement) {
        _restorePreFullscreenState(container, canvas);
    }
});

async function deletePointFromSupabase(debaterId, date) {
    if (!debaterId || !date) return;

    try {
        // 1️⃣ Get the current history
        const { data: debater, error: fetchError } = await supabaseClient
            .from('debaters')
            .select('history')
            .eq('id', debaterId)
            .single();

        if (fetchError) {
            showToast(
                `Failed to fetch debater history: ${fetchError.message}`,
                'error'
            );
            return;
        }

        // 2️⃣ Remove the point with the matching date
        const newHistory = (debater.history || []).filter(
            (pt) => pt.date !== date
        );

        // 3️⃣ Update the debater's history in Supabase
        const { error: updateError } = await supabaseClient
            .from('debaters')
            .update({ history: newHistory })
            .eq('id', debaterId);

        if (updateError) {
            showToast(
                `Failed to update debater history: ${updateError.message}`,
                'error'
            );
        } else {
            showToast(
                `Deleted Elo point for debater ${debaterId} on ${date}`,
                'success'
            );
        }
    } catch (err) {
        showToast(`⚠️ Unexpected error: ${err.message}`, 'warning');
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
