import {
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    TimeScale,
    Tooltip,
    type ActiveElement,
    type Chart,
    type ChartEvent,
    type ChartOptions,
    type TimeUnit,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    adjacentAnchor,
    formatCalendarDate,
    MAX_ZOOM,
    parseCalendarDate,
    zoomWindow,
    type ChartPoint,
    type ChartSeries,
    type ZoomLevel,
} from '../domain';
import { EmptyChart } from './illustrations/EmptyChart';
import { DURATIONS, useReducedMotion } from '../lib/motion';

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

const ANNOTATIONS = '__annotations__';
const DAY = 86_400_000;
/** How long a click waits before zooming, so a double-click can cancel it. */
const CLICK_DELAY = 250;

interface Zoom {
    level: ZoomLevel;
    anchor: string;
}

const ALL_TIME: Zoom = { level: 0, anchor: '' };

const zoomedOut = (z: Zoom): Zoom =>
    z.level <= 1 ? ALL_TIME : { level: (z.level - 1) as ZoomLevel, anchor: z.anchor };

function toChartX(date: string): Date {
    return parseCalendarDate(date) ?? new Date(date);
}

const msOf = (date: string) => toChartX(date).getTime();

function dateOf(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Where a series' line crosses a date (null when the line doesn't reach it). */
function valueAt(data: ChartPoint[], date: string): number | null {
    let before: ChartPoint | null = null;
    let after: ChartPoint | null = null;
    for (const p of data) {
        if (p.x <= date && (!before || p.x > before.x)) before = p;
        if (p.x > date && (!after || p.x < after.x)) after = p;
    }
    if (!before) return null;
    if (!after) return before.x === date ? before.y : null;
    const t0 = msOf(before.x);
    const t1 = msOf(after.x);
    const f = t1 === t0 ? 0 : (msOf(date) - t0) / (t1 - t0);
    return before.y + (after.y - before.y) * f;
}

/** A rounded Elo range covering everything drawn between two dates. */
function visibleDomain(series: ChartSeries[], start: string, end: string) {
    let min = Infinity;
    let max = -Infinity;
    const take = (v: number | null) => {
        if (v === null || !Number.isFinite(v)) return;
        if (v < min) min = v;
        if (v > max) max = v;
    };
    for (const s of series) {
        if (s.id === ANNOTATIONS) continue;
        for (const p of s.data) if (p.x >= start && p.x < end) take(p.y);
        take(valueAt(s.data, start));
        take(valueAt(s.data, end));
    }
    if (!Number.isFinite(min)) return null;
    const pad = Math.max(12, (max - min) * 0.08 || 24);
    return {
        min: Math.floor((min - pad) / 10) * 10,
        max: Math.ceil((max + pad) / 10) * 10,
    };
}

function timeAxis(spanDays: number): { unit: TimeUnit; format: string } {
    if (spanDays > 100) return { unit: 'month', format: "MMM ''yy" };
    if (spanDays > 40) return { unit: 'week', format: 'MMM d' };
    return { unit: 'day', format: 'MMM d' };
}

/** The date of the point that was clicked (or under the cursor). */
function clickedDate(
    event: ChartEvent,
    elements: ActiveElement[],
    chart: Chart
): string | null {
    const el = elements[0];
    if (el) {
        const ds = chart.data.datasets[el.datasetIndex] as unknown as {
            data: { date?: string }[];
        };
        const date = ds.data[el.index]?.date;
        if (date) return date;
    }
    if (event.x == null) return null;
    const ms = chart.scales.x?.getValueForPixel(event.x);
    return ms == null || !Number.isFinite(ms) ? null : dateOf(ms);
}

export function EloChart({
    series,
    yMin,
    yMax,
    isEmpty,
    onPointClick,
    framed = false,
}: {
    series: ChartSeries[];
    yMin: number | null;
    yMax: number | null;
    isEmpty: boolean;
    /** When given, clicking a point calls this instead of zooming. */
    onPointClick?: (debaterId: string, date: string) => void;
    framed?: boolean;
}) {
    const reduced = useReducedMotion();
    const clickRef = useRef(onPointClick);
    clickRef.current = onPointClick;

    // Zoom resets when a different person or team is shown first
    const [zoom, setZoom] = useState<Zoom>(ALL_TIME);
    const primaryId = series.find((s) => s.id !== ANNOTATIONS)?.id ?? '';
    const [zoomFor, setZoomFor] = useState(primaryId);
    if (zoomFor !== primaryId) {
        setZoomFor(primaryId);
        setZoom(ALL_TIME);
    }
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const beforeClickRef = useRef<Zoom>(zoom);
    const pendingRef = useRef<number | null>(null);
    const cancelPending = () => {
        if (pendingRef.current !== null) {
            window.clearTimeout(pendingRef.current);
            pendingRef.current = null;
        }
    };
    useEffect(() => cancelPending, []);

    const win = zoom.level > 0 ? zoomWindow(zoom.level, zoom.anchor) : null;
    const domain = useMemo(
        () => (win ? visibleDomain(series, win.start, win.end) : null),
        [series, win?.start, win?.end]
    );
    const viewMin = domain ? domain.min : yMin;
    const viewMax = domain ? domain.max : yMax;

    // First and last dates with data (for the step arrows and tick spacing)
    const extent = useMemo(() => {
        let min = '';
        let max = '';
        for (const s of series) {
            if (s.id === ANNOTATIONS) continue;
            for (const p of s.data) {
                if (!min || p.x < min) min = p.x;
                if (!max || p.x > max) max = p.x;
            }
        }
        return min && max ? { min, max } : null;
    }, [series]);

    const spanDays = win
        ? (msOf(win.end) - msOf(win.start)) / DAY
        : extent
          ? (msOf(extent.max) - msOf(extent.min)) / DAY
          : 0;
    const axis = timeAxis(spanDays);

    const data = useMemo(() => {
        return {
            datasets: series.map((s, i) => {
                const isAnno = s.id === ANNOTATIONS;
                const color = HEX[i % HEX.length];
                return {
                    label: s.label,
                    id: s.id,
                    data: s.data.map((p) => ({
                        x: toChartX(p.x),
                        // markers for important dates sit along the bottom edge
                        y: isAnno && viewMin !== null ? viewMin : p.y,
                        date: p.x,
                        event: p.event,
                    })),
                    borderColor: isAnno ? '#c0392b' : color,
                    backgroundColor: isAnno ? '#c0392b' : `${color}22`,
                    fill: !isAnno && series.length <= 2,
                    tension: 0.25,
                    // no overshoot between points, which shows when zoomed in
                    cubicInterpolationMode: 'monotone' as const,
                    borderWidth: isAnno ? 0 : series.length > 8 ? 1.25 : 2,
                    pointRadius: isAnno ? 8 : s.data.length === 1 || zoom.level >= 3 ? 4 : 2,
                    pointHoverRadius: 5,
                    pointStyle: isAnno ? ('star' as const) : ('circle' as const),
                    showLine: !isAnno,
                    spanGaps: false,
                };
            }),
        };
    }, [series, viewMin, zoom.level]);

    const chartDuration = reduced ? 0 : DURATIONS.chart * 1000;

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: chartDuration,
                easing: 'easeOutQuart',
            },
            interaction: { mode: 'nearest', intersect: false },
            onClick: (event, elements, chart) => {
                if (clickRef.current) {
                    if (!elements.length) return;
                    const el = elements[0];
                    const ds = chart.data.datasets[el.datasetIndex] as {
                        id?: string;
                        data: { date?: string }[];
                    };
                    if (!ds.id || ds.id === ANNOTATIONS) return;
                    const point = ds.data[el.index];
                    if (point?.date) clickRef.current(ds.id, point.date);
                    return;
                }
                // The second click of a double-click is left to the zoom-out handler
                const native = event.native as MouseEvent | null;
                if (native && native.detail > 1) return;
                const anchor = clickedDate(event, elements, chart);
                if (!anchor) return;
                cancelPending();
                pendingRef.current = window.setTimeout(() => {
                    pendingRef.current = null;
                    setZoom((z) =>
                        z.level >= MAX_ZOOM
                            ? z
                            : { level: (z.level + 1) as ZoomLevel, anchor }
                    );
                }, CLICK_DELAY);
            },
            plugins: {
                legend: {
                    display: series.filter((s) => s.id !== ANNOTATIONS).length > 1,
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
                            if ((ctx.dataset as { id?: string }).id === ANNOTATIONS) {
                                return raw.event || 'Event';
                            }
                            const elo = Math.round(ctx.parsed.y ?? 0);
                            const main = `${ctx.dataset.label}: ${elo}`;
                            return raw.event ? [main, ...raw.event.split(' · ')] : main;
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'time',
                    min: win ? msOf(win.start) : undefined,
                    max: win ? msOf(win.end) - 1 : undefined,
                    time: {
                        unit: axis.unit,
                        isoWeekday: true,
                        tooltipFormat: 'MMM d, yyyy',
                        displayFormats: { [axis.unit]: axis.format },
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { maxRotation: 0, color: '#9aa3b5' },
                    title: { display: false },
                },
                y: {
                    min: viewMin ?? undefined,
                    max: viewMax ?? undefined,
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    // only round numbers on the axis, not the padded ends
                    ticks: { color: '#9aa3b5', includeBounds: false },
                    title: { display: true, text: 'Elo', color: '#9aa3b5' },
                },
            },
        }),
        [series, viewMin, viewMax, chartDuration, win?.start, win?.end, axis.unit, axis.format]
    );

    if (isEmpty) {
        return (
            <div className="empty chart-empty" style={{ height: '100%' }}>
                <EmptyChart size={120} />
                <strong>No Elo history yet</strong>
                <p>Record a practice round or tournament to see progression.</p>
            </div>
        );
    }

    const wrapClass = framed ? 'chart-wrap chart-wrap--framed' : 'chart-wrap';
    const canPrev = !!(win && extent && win.start > extent.min);
    const canNext = !!(win && extent && win.end <= extent.max);
    const step = (dir: -1 | 1) => {
        if (zoom.level === 0) return;
        cancelPending();
        setZoom({ level: zoom.level, anchor: adjacentAnchor(zoom.level, zoom.anchor, dir) });
    };

    return (
        <div className="chart-zoomable">
            <div className="chart-zoom">
                {win ? (
                    <>
                        <span className="chart-zoom__nav">
                            <button
                                type="button"
                                className="chart-zoom__step"
                                aria-label="Previous period"
                                disabled={!canPrev}
                                onClick={() => step(-1)}
                            >
                                ‹
                            </button>
                            <span className="chart-zoom__label" aria-live="polite">
                                {win.label}
                            </span>
                            <button
                                type="button"
                                className="chart-zoom__step"
                                aria-label="Next period"
                                disabled={!canNext}
                                onClick={() => step(1)}
                            >
                                ›
                            </button>
                        </span>
                        <span className="chart-zoom__actions">
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    cancelPending();
                                    setZoom(zoomedOut(zoom));
                                }}
                            >
                                Zoom out
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    cancelPending();
                                    setZoom(ALL_TIME);
                                }}
                            >
                                Show all
                            </button>
                        </span>
                    </>
                ) : (
                    <span className="chart-zoom__label chart-zoom__label--idle" aria-live="polite">
                        All time
                    </span>
                )}
            </div>
            <div
                className={wrapClass}
                role="img"
                aria-label="Elo history chart"
                onClick={(e) => {
                    if (e.detail <= 1) beforeClickRef.current = zoomRef.current;
                }}
                onDoubleClick={() => {
                    if (clickRef.current) return;
                    cancelPending();
                    setZoom(zoomedOut(beforeClickRef.current));
                }}
            >
                <Line data={data} options={options} />
            </div>
            <p className="chart-zoom__hint">
                {onPointClick ? (
                    'Click a point to delete it'
                ) : (
                    <>
                        <span className="hint-pointer">
                            Click a point to zoom in · double-click to zoom out
                        </span>
                        <span className="hint-touch">Tap a point to zoom in</span>
                    </>
                )}
            </p>
        </div>
    );
}
