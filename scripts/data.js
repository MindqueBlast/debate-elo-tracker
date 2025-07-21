

// --- ANALYTICS & DATA ---
function renderChart() {
    const selectedDebaterId = document.getElementById('analyticsDebater').value;
    const showAnnotations = document.getElementById('showAnnotations').checked;
    const ctx = document.getElementById('eloChart').getContext('2d');
    
    if (eloChart) { eloChart.destroy(); }
    
    const chartOptions = {
        scales: {
            x: { 
                type: "time", 
                time: { unit: "day", tooltipFormat: "MMM d, yyyy" }, 
                title: { display: true, text: "Date" }
            }, 
            y: { 
                title: { display: true, text: "Elo Rating" }
            } 
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        if (context.dataset.label === 'Important Events') {
                            return context.raw.label;
                        }
                        return `${context.dataset.label}: ${context.formattedValue}`;
                    }
                }
            }
        }
    };
    
    const annotationPointStyle = {
        label: "Important Events",
        pointStyle: "star",
        pointRadius: 10,
        pointBorderWidth: 2,
        pointBackgroundColor: "#c0392b",
        pointBorderColor: "#a93226",
        showLine: false
    };

    if (selectedDebaterId === 'ALL') {
        chartOptions.scales.y.min = 0;
        
        const showGraduated = document.getElementById('showGraduated').checked;
        const debatersToGraph = appData.debaters.filter(d => showGraduated || d.status === 'active');
        
        let datasets = debatersToGraph.map((debater, index) => {
            let historyData = debater.history || [];
            if (debater.status === 'graduated' && debater.graduation_date) {
                historyData = historyData.filter(h => h.date <= debater.graduation_date);
            }

            const color = `hsl(${(index * 360 / debatersToGraph.length)}, 70%, 50%)`;
            return {
                label: debater.name,
                data: historyData.map(h => ({ x: h.date, y: h.elo })),
                borderColor: color, backgroundColor: `${color}1A`, fill: false, tension: 0.1
            };
        });

        if (showAnnotations) {
            const annotationsData = (appData.annotations || []).map(a => ({ 
                x: a.date, 
                y: 0, 
                label: a.name 
            }));
            datasets.push({ ...annotationPointStyle, data: annotationsData });
        }

        eloChart = new Chart(ctx, { type: 'line', data: { datasets: datasets }, options: chartOptions });

    } else {
        chartOptions.scales.y.min = undefined;
        
        const debater = appData.debaters.find(d => d.id === selectedDebaterId);
        if (!debater || !debater.history || debater.history.length === 0) return;

        let historyData = debater.history;
        if (debater.status === 'graduated' && debater.graduation_date) {
             historyData = historyData.filter(h => h.date <= debater.graduation_date);
        }

        const datasets = [{
            label: `${debater.name}'s Elo`,
            data: historyData.map(h => ({ x: h.date, y: h.elo })),
            borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)', fill: true, tension: 0.1
        }];
        
        if (showAnnotations && historyData.length > 0) {
            const minElo = Math.min(...historyData.map(h => h.elo));
            const annotationsData = (appData.annotations || []).map(a => ({
                x: a.date,
                y: minElo,
                label: a.name
            }));
            datasets.push({ ...annotationPointStyle, data: annotationsData });
        }
        
        eloChart = new Chart(ctx, { type: "line", data: { datasets: datasets }, options: chartOptions });
    }
}
