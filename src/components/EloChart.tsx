import {
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    TimeScale,
    Tooltip,
    type ChartOptions,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { formatCalendarDate, parseCalendarDate, type ChartSeries } from '../domain';

ChartJS.register(
    TimeScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler
);

const HEX = [
    '#dc3b3b',
    '#6ea8fe',
    '#3ecf8e',
    '#e2c36b',
    '#c084fc',
    '#67e8f9',
];

function toChartX(date: string): Date {
    return parseCalendarDate(date) ?? new Date(date);
}

export function EloChart({
    series,
    yMin,
    yMax,
    isEmpty,
    onPointClick,
}: {
    series: ChartSeries[];
    yMin: number | null;
    yMax: number | null;
    isEmpty: boolean;
    onPointClick?: (debaterId: string, date: string) => void;
}) {
    const clickRef = useRef(onPointClick);
    clickRef.current = onPointClick;

    const data = useMemo(() => {
        return {
            datasets: series.map((s, i) => {
                const isAnno = s.id === '__annotations__';
                const color = HEX[i % HEX.length];
                return {
                    label: s.label,
                    id: s.id,
                    data: s.data.map((p) => ({
                        x: toChartX(p.x),
                        y: p.y,
                        date: p.x,
                        event: p.event,
                    })),
                    borderColor: isAnno ? '#c0392b' : color,
                    backgroundColor: isAnno ? '#c0392b' : `${color}22`,
                    fill: !isAnno && series.length <= 2 && s.id !== '__annotations__',
                    tension: 0.25,
                    borderWidth: isAnno ? 0 : series.length > 8 ? 1.25 : 2,
                    pointRadius: isAnno ? 8 : s.data.length === 1 ? 4 : 2,
                    pointHoverRadius: 5,
                    pointStyle: isAnno ? ('star' as const) : ('circle' as const),
                    showLine: !isAnno,
                    spanGaps: false,
                };
            }),
        };
    }, [series]);

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 400,
                easing: 'easeOutQuart',
            },
            interaction: { mode: 'nearest', intersect: false },
            onClick: (_event, elements, chart) => {
                if (!clickRef.current || !elements.length) return;
                const el = elements[0];
                const ds = chart.data.datasets[el.datasetIndex] as {
                    id?: string;
                    label?: string;
                    data: { date?: string }[];
                };
                if (!ds.id || ds.id === '__annotations__') return;
                const point = ds.data[el.index];
                if (point?.date) clickRef.current(ds.id, point.date);
            },
            plugins: {
                legend: {
                    display: series.filter((s) => s.id !== '__annotations__').length > 1,
                    labels: {
                        boxWidth: 10,
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-muted')
                            .trim() || '#9aa3b5',
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(12, 14, 18, 0.94)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        title: (items) => {
                            const raw = items[0]?.raw as { date?: string } | undefined;
                            return raw?.date
                                ? formatCalendarDate(raw.date)
                                : '';
                        },
                        label: (ctx) => {
                            const raw = ctx.raw as { event?: string };
                            if (ctx.dataset.label === 'Important Dates') {
                                return raw.event || 'Event';
                            }
                            const elo = Math.round(ctx.parsed.y ?? 0);
                            return raw.event
                                ? `${ctx.dataset.label}: ${elo} (${raw.event})`
                                : `${ctx.dataset.label}: ${elo}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'day', tooltipFormat: 'MMM d, yyyy' },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { maxRotation: 0, color: '#9aa3b5' },
                    title: { display: false },
                },
                y: {
                    min: yMin ?? undefined,
                    max: yMax ?? undefined,
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: '#9aa3b5' },
                    title: { display: true, text: 'Elo', color: '#9aa3b5' },
                },
            },
        }),
        [series, yMin, yMax]
    );

    if (isEmpty) {
        return (
            <div className="empty" style={{ height: '100%' }}>
                <strong>No Elo history yet</strong>
                <p>Record a practice round or tournament to see progression.</p>
            </div>
        );
    }

    return (
        <div className="chart-wrap" role="img" aria-label="Elo history chart">
            <Line data={data} options={options} />
        </div>
    );
}
