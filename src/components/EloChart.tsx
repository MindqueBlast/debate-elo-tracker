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
    formatCalendarDate,
    MAX_ZOOM,
    parseCalendarDate,
    shiftCenter,
    ZOOM_LEVEL_NAMES,
    zoomWindow,
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
    '#f472b6',
    '#a3e635',
    '#fb923c',
    '#818cf8',
];

const ANNOTATIONS = '__annotations__';
const DAY = 86_400_000;
/** How long a click waits before zooming, so a double-click can cancel it. */
const CLICK_DELAY = 250;

interface Zoom {
    level: ZoomLevel;
    /** The day the view is centred on. */
    center: string;
}

const ALL_TIME: Zoom = { level: 0, center: '' };

const zoomedOut = (z: Zoom): Zoom =>
    z.level <= 1 ? ALL_TIME : { level: (z.level - 1) as ZoomLevel, center: z.center };

/** A series' points as timestamps, for working out what's on screen. */
type Timed = { t: number; y: number }[];

function toChartX(date: string): Date {
    return parseCalendarDate(date) ?? new Date(date);
}

const msOf = (date: string) => toChartX(date).getTime();

function dateOf(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Where a series' line crosses a moment (null when the line doesn't reach it). */
function valueAt(points: Timed, t: number): number | null {
    let before: Timed[number] | null = null;
    let after: Timed[number] | null = null;
    for (const p of points) {
        if (p.t <= t && (!before || p.t > before.t)) before = p;
        if (p.t > t && (!after || p.t < after.t)) after = p;
    }
    if (!before) return null;
    if (!after) return before.t === t ? before.y : null;
    const f = (t - before.t) / (after.t - before.t);
    return before.y + (after.y - before.y) * f;
}

/** A rounded Elo range covering everything drawn between two moments. */
function visibleDomain(lines: Timed[], start: number, end: number) {
    let min = Infinity;
    let max = -Infinity;
    const take = (v: number | null) => {
        if (v === null || !Number.isFinite(v)) return;
        if (v < min) min = v;
        if (v > max) max = v;
    };
    for (const points of lines) {
        for (const p of points) if (p.t >= start && p.t <= end) take(p.y);
        take(valueAt(points, start));
        take(valueAt(points, end));
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
    // Lines switched off from the legend (or all at once)
    const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
    if (zoomFor !== primaryId) {
        setZoomFor(primaryId);
        setZoom(ALL_TIME);
        setHidden(new Set());
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

    const lines = useMemo(
        () =>
            series
                .filter((s) => s.id !== ANNOTATIONS)
                .map((s) => ({ id: s.id, points: s.data.map((p) => ({ t: msOf(p.x), y: p.y })) })),
        [series]
    );
    const shown = useMemo(
        () => lines.filter((l) => !hidden.has(l.id)).map((l) => l.points),
        [lines, hidden]
    );
    const hiddenCount = lines.filter((l) => hidden.has(l.id)).length;
    // First and last moments with data (for the step arrows and tick spacing)
    const extent = useMemo(() => {
        let min = Infinity;
        let max = -Infinity;
        for (const { points } of lines) {
            for (const p of points) {
                if (p.t < min) min = p.t;
                if (p.t > max) max = p.t;
            }
        }
        return Number.isFinite(min) ? { min, max } : null;
    }, [lines]);

    const win = zoom.level > 0 ? zoomWindow(zoom.level, zoom.center) : null;
    const viewStart = win ? msOf(win.center) - win.halfDays * DAY : null;
    const viewEnd = win ? msOf(win.center) + win.halfDays * DAY : null;
    // The Elo axis fits what's on screen: the zoomed window and the lines still showing
    const domain = useMemo(() => {
        if (viewStart !== null && viewEnd !== null) return visibleDomain(shown, viewStart, viewEnd);
        if (hiddenCount > 0) return visibleDomain(shown, -Infinity, Infinity);
        return null;
    }, [shown, viewStart, viewEnd, hiddenCount]);
    const viewMin = domain ? domain.min : yMin;
    const viewMax = domain ? domain.max : yMax;

    const spanDays = win
        ? win.halfDays * 2
        : extent
          ? (extent.max - extent.min) / DAY
          : 0;
    const axis = timeAxis(spanDays);

    const data = useMemo(() => {
        return {
            datasets: series.map((s, i) => {
                const isAnno = s.id === ANNOTATIONS;
                const color = HEX[i % HEX.length];
                const radius = s.data.length === 1 || zoom.level >= 3 ? 4 : 2;
                // dots only where they actually played; skipped tournaments are just line
                const noDot = (p: ChartSeries['data'][number]) =>
                    p.competed === false && s.data.length > 1;
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
                    hidden: hidden.has(s.id),
                    tension: 0.25,
                    // no overshoot between points, which shows when zoomed in
                    cubicInterpolationMode: 'monotone' as const,
                    borderWidth: isAnno ? 0 : series.length > 8 ? 1.25 : 2,
                    pointRadius: isAnno ? 8 : s.data.map((p) => (noDot(p) ? 0 : radius)),
                    pointHoverRadius: isAnno ? 5 : s.data.map((p) => (noDot(p) ? 3 : 5)),
                    pointStyle: isAnno ? ('star' as const) : ('circle' as const),
                    showLine: !isAnno,
                    spanGaps: false,
                };
            }),
        };
    }, [series, viewMin, zoom.level, hidden]);

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
                const center = clickedDate(event, elements, chart);
                if (!center) return;
                cancelPending();
                pendingRef.current = window.setTimeout(() => {
                    pendingRef.current = null;
                    // one step in, centred on the clicked point (at the closest
                    // zoom it just re-centres)
                    setZoom((z) => ({
                        level: Math.min(z.level + 1, MAX_ZOOM) as ZoomLevel,
                        center,
                    }));
                }, CLICK_DELAY);
            },
            plugins: {
                legend: {
                    display: series.filter((s) => s.id !== ANNOTATIONS).length > 1,
                    // clicking a name crosses it off (or brings it back)
                    onClick: (_event, item) => {
                        const id = series[item.datasetIndex ?? -1]?.id;
                        if (!id) return;
                        setHidden((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                        });
                    },
                    labels: {
                        // names A–Z (colours stay with each person); important dates last
                        sort: (a, b, chartData) => {
                            const anno = (i?: number) =>
                                (chartData.datasets[i ?? -1] as { id?: string } | undefined)?.id ===
                                ANNOTATIONS
                                    ? 1
                                    : 0;
                            return (
                                anno(a.datasetIndex) - anno(b.datasetIndex) ||
                                a.text.localeCompare(b.text, undefined, { sensitivity: 'base' })
                            );
                        },
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
                    min: viewStart ?? undefined,
                    max: viewEnd ?? undefined,
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
        [series, viewMin, viewMax, chartDuration, viewStart, viewEnd, axis.unit, axis.format]
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
    const canPrev = !!(extent && viewStart !== null && viewStart > extent.min);
    const canNext = !!(extent && viewEnd !== null && viewEnd < extent.max);
    const step = (dir: -1 | 1) => {
        if (zoom.level === 0) return;
        cancelPending();
        setZoom({ level: zoom.level, center: shiftCenter(zoom.level, zoom.center, dir) });
    };

    return (
        <div className="chart-zoomable">
            <div className="chart-zoom">
                {win ? (
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
                            <span className="chart-zoom__level">
                                {ZOOM_LEVEL_NAMES[zoom.level]}
                            </span>{' '}
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
                ) : (
                    <span className="chart-zoom__label chart-zoom__label--idle" aria-live="polite">
                        All time
                    </span>
                )}
                <span className="chart-zoom__actions">
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!win}
                        onClick={() => {
                            cancelPending();
                            setZoom(zoomedOut(zoom));
                        }}
                    >
                        Zoom out
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!win}
                        onClick={() => {
                            cancelPending();
                            setZoom(ALL_TIME);
                        }}
                    >
                        Reset zoom
                    </button>
                </span>
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
            <div className="chart-footer">
                {lines.length > 1 && (
                    <span className="chart-footer__lines">
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={hiddenCount === lines.length}
                            onClick={() => setHidden(new Set(lines.map((l) => l.id)))}
                        >
                            Hide all lines
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={hiddenCount === 0}
                            onClick={() => setHidden(new Set())}
                        >
                            Show all lines
                        </button>
                    </span>
                )}
                <p className="chart-zoom__hint">
                    {lines.length > 1 && hiddenCount === lines.length ? (
                        'Click names above the chart to bring lines back'
                    ) : onPointClick ? (
                        'Click a point to delete it'
                    ) : (
                        <>
                            <span className="hint-pointer">
                                Click a point to zoom in · double-click to zoom out
                                {lines.length > 1 ? ' · click a name to hide it' : ''}
                            </span>
                            <span className="hint-touch">
                                Tap a point to zoom in
                                {lines.length > 1 ? ' · tap a name to hide it' : ''}
                            </span>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
