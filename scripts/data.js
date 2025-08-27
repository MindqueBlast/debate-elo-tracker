// --- ANALYTICS & DATA ---
function renderChart() {
    const selectedDebaterId = document.getElementById('analyticsDebater').value;
    const showAnnotations = document.getElementById('showAnnotations').checked;
    const ctx = document.getElementById('eloChart').getContext('2d');

    if (eloChart) {
        eloChart.destroy();
    }

    const chartOptions = {
        animation: { duration: 800, easing: 'easeInOutQuart' },
        transitions: {
            show: {
                animations: {
                    x: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    y: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                },
            },
            hide: {
                animations: {
                    x: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    y: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                },
            },
            active: {
                animations: {
                    x: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    y: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                },
            },
        },
        onClick: (event, elements) => {
            if (!elements.length) return;
            const element = elements[0];
            const dataset = eloChart.data.datasets[element.datasetIndex];
            const point = dataset.data[element.index];

            const debaterName = dataset.label;
            const debaterId = dataset.id || null;
            const date = new Date(point.x).toISOString().split('T')[0];

            if (confirm(`Delete Elo point for ${debaterName} on ${date}?`)) {
                dataset.data.splice(element.index, 1);
                eloChart.update();
            }
        },
        scales: {
            x: {
                type: 'time',
                time: { unit: 'day', tooltipFormat: 'MMM d, yyyy' },
                title: { display: true, text: 'Date' },
            },
            y: { title: { display: true, text: 'Elo Rating' } },
        },
        plugins: {
            tooltip: {
                enabled: true,
                mode: 'nearest',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#666',
                borderWidth: 1,
                cornerRadius: 6,
                displayColors: true,
                callbacks: {
                    title: function (context) {
                        if (!context.length) return '';
                        const xValue = context[0].parsed.x;
                        return xValue
                            ? new Date(xValue).toLocaleDateString()
                            : '';
                    },
                    label: function (context) {
                        if (context.dataset.label === 'Important Events') {
                            return context.raw.label;
                        }
                        return `${context.dataset.label}: ${context.parsed.y}`;
                    },
                },
            },
        },
    };

    const annotationPointStyle = {
        label: 'Important Events',
        pointStyle: 'star',
        pointRadius: 10,
        pointBorderWidth: 2,
        pointBackgroundColor: '#c0392b',
        pointBorderColor: '#a93226',
        showLine: false,
        hoverRadius: 0, // Prevent freeze
        pointHitRadius: 5, // Small hover area
    };

    let datasets = [];

    if (selectedDebaterId === 'ALL') {
        chartOptions.scales.y.min = 0;
        const showGraduated = document.getElementById('showGraduated').checked;
        const debatersToGraph = appData.debaters.filter(
            (d) => showGraduated || d.status === 'active'
        );

        datasets = debatersToGraph.map((debater, index) => {
            let historyData = debater.history || [];
            if (debater.status === 'graduated' && debater.graduation_date) {
                historyData = historyData.filter(
                    (h) => h.date <= debater.graduation_date
                );
            }
            const color = `hsl(${
                (index * 360) / debatersToGraph.length
            }, 70%, 50%)`;
            return {
                label: debater.name,
                data: historyData.map((h) => ({ x: h.date, y: h.elo })),
                borderColor: color,
                backgroundColor: `${color}1A`,
                fill: false,
                tension: 0.1,
                borderWidth: 1.5,
            };
        });

        if (showAnnotations) {
            const annotationsData = (appData.annotations || []).map((a) => ({
                x: a.date,
                y: 0,
                label: a.name,
            }));
            datasets.push({ ...annotationPointStyle, data: annotationsData });
        }
    } else {
        chartOptions.scales.y.min = undefined;
        const debater = appData.debaters.find(
            (d) => d.id === selectedDebaterId
        );
        if (!debater || !debater.history || debater.history.length === 0)
            return;

        let historyData = debater.history;
        if (debater.status === 'graduated' && debater.graduation_date) {
            historyData = historyData.filter(
                (h) => h.date <= debater.graduation_date
            );
        }

        datasets.push({
            label: `${debater.name}'s Elo`,
            data: historyData.map((h) => ({ x: h.date, y: h.elo })),
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            fill: true,
            tension: 0.1,
            borderWidth: 1.5,
        });

        if (showAnnotations) {
            const minElo = Math.min(...historyData.map((h) => h.elo));
            const annotationsData = (appData.annotations || []).map((a) => ({
                x: a.date,
                y: minElo,
                label: a.name,
            }));
            datasets.push({ ...annotationPointStyle, data: annotationsData });
        }
    }

    eloChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: chartOptions,
    });
}

// --- VIEWER ANALYTICS & DATA ---
let viewerEloChart = null;
function renderViewerChart() {
    const selectedDebaterId = document.getElementById(
        'viewerAnalyticsDebater'
    ).value;
    const showAnnotations =
        document.getElementById('viewerShowAnnotations')?.checked ?? false;
    const ctx = document.getElementById('viewerEloChart').getContext('2d');
    if (viewerEloChart) {
        viewerEloChart.destroy();
    }

    const chartOptions = {
        animation: {
            duration: 800,
            easing: 'easeInOutQuart',
        },
        transitions: {
            show: {
                animations: {
                    x: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    y: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    borderColor: { duration: 800, easing: 'easeInOutQuart' },
                    backgroundColor: {
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                },
            },
            hide: {
                animations: {
                    x: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    y: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    borderColor: { duration: 800, easing: 'easeInOutQuart' },
                    backgroundColor: {
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                },
            },
            active: {
                animations: {
                    x: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    y: {
                        type: 'number',
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                    borderColor: { duration: 800, easing: 'easeInOutQuart' },
                    backgroundColor: {
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                },
            },
        },
        scales: {
            x: {
                type: 'time',
                time: { unit: 'day', tooltipFormat: 'MMM d, yyyy' },
                title: { display: true, text: 'Date' },
            },
            y: {
                title: { display: true, text: 'Elo Rating' },
            },
        },
        plugins: {
            tooltip: {
                enabled: true,
                mode: 'nearest',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#666',
                borderWidth: 1,
                cornerRadius: 6,
                displayColors: true,
                callbacks: {
                    label: function (context) {
                        if (context.dataset.label === 'Important Events') {
                            return context.raw.label;
                        }
                        return `${context.dataset.label}: ${context.formattedValue}`;
                    },
                },
            },
        },
    };

    const annotationPointStyle = {
        label: 'Important Events',
        pointStyle: 'star',
        pointRadius: 10,
        pointBorderWidth: 2,
        pointBackgroundColor: '#c0392b',
        pointBorderColor: '#a93226',
        showLine: false,
    };

    if (selectedDebaterId === 'ALL') {
        chartOptions.scales.y.min = 0;
        const debatersToGraph = appData.debaters.filter(
            (d) => d.status === 'active'
        );
        let datasets = debatersToGraph.map((debater, index) => {
            let historyData = debater.history || [];
            if (debater.status === 'graduated' && debater.graduation_date) {
                historyData = historyData.filter(
                    (h) => h.date <= debater.graduation_date
                );
            }
            const color = `hsl(${
                (index * 360) / debatersToGraph.length
            }, 70%, 50%)`;
            return {
                label: debater.name,
                data: historyData.map((h) => ({ x: h.date, y: h.elo })),
                borderColor: color,
                backgroundColor: `${color}1A`,
                fill: false,
                tension: 0.1,
                borderWidth: 1.5,
            };
        });
        if (showAnnotations) {
            const annotationsData = (appData.annotations || []).map((a) => ({
                x: a.date,
                y: 0,
                label: a.name,
            }));
            datasets.push({ ...annotationPointStyle, data: annotationsData });
        }
        viewerEloChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: chartOptions,
        });
    } else {
        chartOptions.scales.y.min = undefined;
        const debater = appData.debaters.find(
            (d) => d.id === selectedDebaterId
        );
        if (!debater || !debater.history || debater.history.length === 0)
            return;
        let historyData = debater.history;
        if (debater.status === 'graduated' && debater.graduation_date) {
            historyData = historyData.filter(
                (h) => h.date <= debater.graduation_date
            );
        }
        const datasets = [
            {
                label: `${debater.name}'s Elo`,
                data: historyData.map((h) => ({ x: h.date, y: h.elo })),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.1,
                borderWidth: 1.5,
            },
        ];
        if (showAnnotations && historyData.length > 0) {
            const minElo = Math.min(...historyData.map((h) => h.elo));
            const annotationsData = (appData.annotations || []).map((a) => ({
                x: a.date,
                y: minElo,
                label: a.name,
            }));
            datasets.push({ ...annotationPointStyle, data: annotationsData });
        }
        viewerEloChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: chartOptions,
        });
    }
}

function viewerToggleFullscreen() {
    const chartContainer =
        document.getElementById('viewerEloChart').parentElement;
    if (!document.fullscreenElement) {
        chartContainer.requestFullscreen?.();
    } else {
        document.exitFullscreen?.();
    }
}

function removeChartPoint(debaterId, targetDate) {
    if (!eloChart || !eloChart.data || !eloChart.data.datasets) return;

    for (const dataset of eloChart.data.datasets) {
        if (dataset.id === debaterId || dataset.label === getName(debaterId)) {
            dataset.data = dataset.data.filter((pt) => {
                const ptDate = new Date(pt.x).toISOString().split('T')[0];
                const tDate = new Date(targetDate).toISOString().split('T')[0];
                return ptDate !== tDate;
            });
        }
    }

    eloChart.update();
}

function updateAnalyticsDebaterSelects() {
    const mainSelect = document.getElementById('analyticsDebater');
    const compareSelect = document.getElementById('compareDebater');
    if (!mainSelect || !compareSelect) return;
    mainSelect.innerHTML = '';
    // Add 'ALL' option
    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = '-- All Debaters --';
    mainSelect.appendChild(allOption);
    compareSelect.innerHTML = '<option value="">-- None --</option>';
    appData.debaters.forEach((debater) => {
        const option = document.createElement('option');
        option.value = debater.id;
        option.textContent = `${debater.name} (${Math.round(debater.elo)})`;
        mainSelect.appendChild(option.cloneNode(true));
        compareSelect.appendChild(option.cloneNode(true));
    });
    if (!mainSelect.value) mainSelect.value = 'ALL';
    // Hide compare if ALL is selected
    function updateCompareState() {
        if (mainSelect.value === 'ALL') {
            compareSelect.disabled = true;
            compareSelect.value = '';
            compareSelect.style.opacity = 0.5;
        } else {
            compareSelect.disabled = false;
            compareSelect.style.opacity = 1;
            Array.from(compareSelect.options).forEach((opt) => {
                if (opt.value && opt.value === mainSelect.value) {
                    opt.style.display = 'none';
                    if (compareSelect.value === opt.value)
                        compareSelect.value = '';
                } else {
                    opt.style.display = '';
                }
            });
        }
    }
    updateCompareState();
    mainSelect.onchange = () => {
        updateCompareState();
        renderChart();
    };
    compareSelect.onchange = renderChart;
    // Style
    mainSelect.style.minWidth = '180px';
    compareSelect.style.minWidth = '180px';
    mainSelect.style.marginBottom = '6px';
    compareSelect.style.marginBottom = '6px';
}

function updateViewerAnalyticsDebaterSelects() {
    const mainSelect = document.getElementById('viewerAnalyticsDebater');
    const compareSelect = document.getElementById('viewerCompareDebater');
    if (!mainSelect || !compareSelect) return;
    mainSelect.innerHTML = '';
    // Add 'ALL' option
    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = '-- All Debaters --';
    mainSelect.appendChild(allOption);
    compareSelect.innerHTML = '<option value="">-- None --</option>';
    appData.debaters
        .filter((d) => d.status === 'active')
        .forEach((debater) => {
            const option = document.createElement('option');
            option.value = debater.id;
            option.textContent = `${debater.name} (${Math.round(debater.elo)})`;
            mainSelect.appendChild(option.cloneNode(true));
            compareSelect.appendChild(option.cloneNode(true));
        });
    if (!mainSelect.value) mainSelect.value = 'ALL';
    function updateCompareState() {
        if (mainSelect.value === 'ALL') {
            compareSelect.disabled = true;
            compareSelect.value = '';
            compareSelect.style.opacity = 0.5;
        } else {
            compareSelect.disabled = false;
            compareSelect.style.opacity = 1;
            Array.from(compareSelect.options).forEach((opt) => {
                if (opt.value && opt.value === mainSelect.value) {
                    opt.style.display = 'none';
                    if (compareSelect.value === opt.value)
                        compareSelect.value = '';
                } else {
                    opt.style.display = '';
                }
            });
        }
    }
    updateCompareState();
    mainSelect.onchange = () => {
        updateCompareState();
        renderViewerChart();
    };
    compareSelect.onchange = renderViewerChart;
    // Style
    mainSelect.style.minWidth = '180px';
    compareSelect.style.minWidth = '180px';
    mainSelect.style.marginBottom = '6px';
    compareSelect.style.marginBottom = '6px';
}

function getDateRangeFilter(history, startDate, endDate) {
    if (!startDate && !endDate) return history;
    return history.filter((h) => {
        const d = h.date;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });
}
