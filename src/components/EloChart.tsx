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
import { LineFinder } from './LineFinder';
import { useReducedMotion } from '../lib/motion';
import { useTheme } from '../state/ThemeProvider';

ChartJS.register(
    TimeScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler
);

/** Line colours, bright on the graphite floor and deeper on white; scarlet leads. */
const PALETTE = {
    dark: ['#ff5a68', '#6ea8fe', '#3ddc97', '#f0b429', '#c084fc', '#67e8f9', '#f472b6', '#a3e635', '#fb923c', '#818cf8'],
    light: ['#c8102e', '#2f6fdb', '#128556', '#a77900', '#8b3fd9', '#0e8aa6', '#c2337a', '#5b8a00', '#d0601b', '#5a55d6'],
} as const;

/**
 * The chart's ink for each theme (the same values as --chart-grid and
 * --chart-tick in global.css), so grid, ticks and tooltips match the page.
 * Set here rather than read from the page, which still has the old theme
 * for a moment after the switch.
 */
const FONT = "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif";
function chartInk(theme: 'dark' | 'light') {
    return {
        palette: PALETTE[theme],
        grid: theme === 'light' ? 'rgba(14, 14, 20, 0.07)' : 'rgba(255, 255, 255, 0.06)',
        tick: theme === 'light' ? '#575a63' : '#a6a8b0',
        scarlet: theme === 'light' ? '#c8102e' : '#ff5a68',
        font: FONT,
    };
}

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

/** How long a line takes to sweep out to its new start (or back in). */
const SWEEP_MS = 800;
/** How long lines take to draw in when a chart first shows. */
const INTRO_MS = 1100;
/** A line that's added draws in from the left this fast... */
const REVEAL_MS = 750;
/** ...and one taken away (or hidden) fades out over this. */
const FADE_MS = 450;
/** Zooming and other changes ease in and out over this. */
const CHANGE_MS = 420;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

type Sweep = {
    /** grow: lines gained earlier points; shrink: they're losing them */
    mode: 'grow' | 'shrink';
    /** per line, the date (ms) where the part that comes or goes meets the rest */
    joins: Map<string, number>;
    start: number;
};

const samePoint = (a: { x: string; y: number }, b: { x: string; y: number }) =>
    a.x === b.x && Math.abs(a.y - b.y) < 1e-6;
/** Whether `long` is `short` with extra points in front. */
const endsWith = (long: ChartSeries['data'], short: ChartSeries['data']) =>
    long.length > short.length &&
    short.length > 0 &&
    short.every((p, i) => samePoint(p, long[long.length - short.length + i]));

/**
 * When the same lines come back with points added or removed only at the
 * start (e.g. Extend records), that part can sweep in or out instead of every
 * point sliding to a new place. Anything else: null.
 */
function startChange(prev: ChartSeries[], next: ChartSeries[]): Omit<Sweep, 'start'> | null {
    if (prev.length !== next.length) return null;
    const joins = new Map<string, number>();
    let mode: Sweep['mode'] | null = null;
    for (let i = 0; i < next.length; i++) {
        const a = prev[i].data;
        const b = next[i].data;
        if (prev[i].id !== next[i].id) return null;
        if (a.length === b.length && a.every((p, j) => samePoint(p, b[j]))) continue;
        const m = endsWith(b, a) ? 'grow' : endsWith(a, b) ? 'shrink' : null;
        if (!m || (mode && mode !== m)) return null;
        mode = m;
        joins.set(next[i].id, msOf(m === 'grow' ? a[0].x : b[0].x));
    }
    return mode ? { mode, joins } : null;
}

export function EloChart({
    series: seriesProp,
    yMin,
    yMax,
    isEmpty,
    onPointClick,
    framed = false,
    resetKey,
    autoHidden,
}: {
    series: ChartSeries[];
    yMin: number | null;
    yMax: number | null;
    isEmpty: boolean;
    /** When given, clicking a point calls this instead of zooming. */
    onPointClick?: (debaterId: string, date: string) => void;
    framed?: boolean;
    /**
     * What the chart is of. When it changes, zoom and hidden lines reset and
     * the lines draw in afresh; when only some lines come and go (a filter),
     * those lines draw in or fade out and the rest stay put. Defaults to the
     * first line's id.
     */
    resetKey?: string;
    /**
     * Lines a filter has crossed off: they stay in the legend, crossed out,
     * and come back when the filter lets them. Crossing a line off (or back
     * on) this way replaces anything done to it by hand.
     */
    autoHidden?: ReadonlySet<string>;
}) {
    const reduced = useReducedMotion();
    const { theme } = useTheme();
    const ink = useMemo(() => chartInk(theme), [theme]);
    const clickRef = useRef(onPointClick);
    clickRef.current = onPointClick;

    // What's drawn. Usually the series passed in; while a line sweeps back in,
    // the old (longer) lines stay up until the sweep finishes.
    const [series, setSeries] = useState(seriesProp);
    const subject = resetKey ?? seriesProp.find((s) => s.id !== ANNOTATIONS)?.id ?? '';
    const subjectRef = useRef(subject);
    // Lines a filter took away, still drawn while they fade out
    const leavingRef = useRef(new Map<string, { s: ChartSeries; timer: number }>());
    const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
    // Lines a filter (or the legend) brought in, drawing in from the left: id → start
    const revealRef = useRef(new Map<string, number | null>());
    const [entering, setEntering] = useState<ReadonlySet<string>>(() => new Set());
    const revealDone = useRef<(ids: string[]) => void>(() => undefined);
    revealDone.current = (ids) =>
        setEntering((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        });
    const drawn = useMemo(() => {
        const extra = [...leavingRef.current.values()].map((l) => l.s).filter((s) => !series.some((x) => x.id === s.id));
        if (!extra.length) return series;
        return [
            ...series.filter((s) => s.id !== ANNOTATIONS),
            ...extra,
            ...series.filter((s) => s.id === ANNOTATIONS),
        ];
        // leaving changes whenever the fading lines do
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [series, leaving]);
    const drawnRef = useRef(drawn);
    drawnRef.current = drawn;
    const sweepRef = useRef<Sweep | null>(null);
    // a sweep redraws by itself, so Chart.js shouldn't also slide points around
    const [instant, setInstant] = useState(false);
    useEffect(
        () => () => {
            for (const l of leavingRef.current.values()) window.clearTimeout(l.timer);
        },
        []
    );
    useEffect(() => {
        if (seriesProp === series) return;
        const sameSubject = subjectRef.current === subject;
        subjectRef.current = subject;
        const change = reduced ? null : startChange(drawnRef.current, seriesProp);
        if (!change) {
            sweepRef.current = null;
            setInstant(false);
            const nextIds = new Set(seriesProp.map((s) => s.id));
            // a line that comes back while fading out just fades back in
            for (const [id, l] of leavingRef.current) {
                if (nextIds.has(id) || !sameSubject || reduced) {
                    window.clearTimeout(l.timer);
                    leavingRef.current.delete(id);
                }
            }
            if (sameSubject && !reduced) {
                const drawnIds = new Set(drawnRef.current.map((s) => s.id));
                for (const s of drawnRef.current) {
                    if (s.id === ANNOTATIONS || nextIds.has(s.id) || leavingRef.current.has(s.id)) continue;
                    const timer = window.setTimeout(() => {
                        leavingRef.current.delete(s.id);
                        setLeaving(new Set(leavingRef.current.keys()));
                    }, FADE_MS);
                    leavingRef.current.set(s.id, { s, timer });
                }
                const added = seriesProp.filter((s) => s.id !== ANNOTATIONS && !drawnIds.has(s.id)).map((s) => s.id);
                if (added.length) {
                    added.forEach((id) => revealRef.current.set(id, null));
                    setEntering((prev) => new Set([...prev, ...added]));
                }
            } else {
                revealRef.current.clear();
                setEntering(new Set());
            }
            setLeaving(new Set(leavingRef.current.keys()));
            setSeries(seriesProp);
            return;
        }
        sweepRef.current = { ...change, start: performance.now() };
        setInstant(true);
        const timers: number[] = [];
        if (change.mode === 'grow') {
            setSeries(seriesProp);
            // later changes (zoom, hiding lines) animate as usual again
            timers.push(window.setTimeout(() => setInstant(false), SWEEP_MS + 50));
        } else {
            timers.push(
                window.setTimeout(() => {
                    sweepRef.current = null;
                    setSeries(seriesProp);
                }, SWEEP_MS)
            );
            timers.push(window.setTimeout(() => setInstant(false), SWEEP_MS + 100));
        }
        return () => timers.forEach((t) => window.clearTimeout(t));
        // series is what's drawn now; only a new prop starts a change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seriesProp, reduced, subject]);
    // When a chart first shows (or shows someone else), its lines draw in
    // from the left. start is set on the first frame actually drawn.
    const introRef = useRef<{ start: number | null } | null>(null);
    const introFor = useRef<string | null>(null);
    const sweepPlugin = useMemo(() => {
        const clipped = new Set<number>();
        let introClipped = false;
        const progress = (s: Sweep) => {
            const t = Math.min(1, (performance.now() - s.start) / SWEEP_MS);
            // eases in and out, so it reads as being drawn
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };
        return {
            id: 'sweep',
            // the first draw-in clips every line (and its shading) at once
            beforeDatasetsDraw(chart: Chart) {
                const intro = introRef.current;
                if (!intro) return;
                if (intro.start === null) intro.start = performance.now();
                const t = Math.min(1, (performance.now() - intro.start) / INTRO_MS);
                if (t >= 1) return;
                const a = chart.chartArea;
                // eases out, like a pen slowing as it reaches today
                const edge = a.left - 12 + (a.right - a.left + 24) * (1 - Math.pow(1 - t, 3));
                chart.ctx.save();
                chart.ctx.beginPath();
                chart.ctx.rect(a.left - 20, a.top - 20, edge - a.left + 20, a.bottom - a.top + 40);
                chart.ctx.clip();
                introClipped = true;
            },
            afterDatasetsDraw(chart: Chart) {
                if (introClipped) {
                    introClipped = false;
                    chart.ctx.restore();
                }
            },
            beforeDatasetDraw(chart: Chart, args: { index: number }) {
                const s = sweepRef.current;
                const id = (chart.data.datasets[args.index] as { id?: string }).id;
                const join = s && id ? s.joins.get(id) : undefined;
                if (!s || join === undefined) {
                    // a line that's just been added draws in from the left, the rest stay put
                    if (!id || !revealRef.current.has(id)) return;
                    const now = performance.now();
                    const start = revealRef.current.get(id) ?? now;
                    revealRef.current.set(id, start);
                    const t = Math.min(1, (now - start) / REVEAL_MS);
                    if (t >= 1) return;
                    const a = chart.chartArea;
                    const edge = a.left - 12 + (a.right - a.left + 24) * easeOut(t);
                    chart.ctx.save();
                    chart.ctx.beginPath();
                    chart.ctx.rect(a.left - 20, a.top - 20, edge - a.left + 20, a.bottom - a.top + 40);
                    chart.ctx.clip();
                    clipped.add(args.index);
                    return;
                }
                const area = chart.chartArea;
                const joinPx = Math.max(area.left, chart.scales.x.getPixelForValue(join));
                const e = progress(s);
                // grow: the edge travels from the join out to the left; shrink: back in to the join
                const edge =
                    s.mode === 'grow' ? joinPx - (joinPx - area.left) * e : area.left + (joinPx - area.left) * e;
                const ctx = chart.ctx;
                ctx.save();
                ctx.beginPath();
                ctx.rect(edge, area.top - 20, area.right - edge + 20, area.bottom - area.top + 40);
                ctx.clip();
                clipped.add(args.index);
            },
            afterDatasetDraw(chart: Chart, args: { index: number }) {
                if (clipped.delete(args.index)) chart.ctx.restore();
            },
            afterDraw(chart: Chart) {
                if (revealRef.current.size) {
                    const now = performance.now();
                    const done = [...revealRef.current]
                        .filter(([, start]) => start !== null && now - start >= REVEAL_MS)
                        .map(([id]) => id);
                    done.forEach((id) => revealRef.current.delete(id));
                    if (done.length) revealDone.current(done);
                    // keep drawing while any are still on their way in (hidden ones wait until shown)
                    const visible = chart.data.datasets.some(
                        (d) => revealRef.current.has((d as { id?: string }).id ?? '') && !d.hidden
                    );
                    if (visible) requestAnimationFrame(() => chart.canvas && chart.draw());
                }
                const intro = introRef.current;
                if (intro) {
                    if (intro.start !== null && performance.now() - intro.start >= INTRO_MS) introRef.current = null;
                    // (a chart that closed mid-draw has no canvas left)
                    else requestAnimationFrame(() => chart.canvas && chart.draw());
                }
                const s = sweepRef.current;
                if (!s) return;
                if (performance.now() - s.start < SWEEP_MS) {
                    requestAnimationFrame(() => chart.draw());
                } else if (s.mode === 'grow') {
                    sweepRef.current = null;
                }
            },
        };
    }, []);

    // Zoom resets when the chart is of something else (not when a filter thins it out)
    const [zoom, setZoom] = useState<Zoom>(ALL_TIME);
    const hasLines = series.some((s) => s.id !== ANNOTATIONS);
    if (introFor.current !== subject) {
        introFor.current = subject;
        introRef.current = reduced || !hasLines ? null : { start: null };
    }
    const [zoomFor, setZoomFor] = useState(subject);
    // Lines switched off from the legend (or all at once), and ones fading on their way off
    const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set(autoHidden ?? []));
    const [fading, setFading] = useState<ReadonlySet<string>>(() => new Set());
    const fadeTimers = useRef(new Map<string, number>());
    const autoKey = autoHidden ? [...autoHidden].sort().join('|') : '';
    const autoRef = useRef({ key: autoKey, ids: new Set(autoHidden ?? []), subject });
    if (zoomFor !== subject) {
        setZoomFor(subject);
        setZoom(ALL_TIME);
        setHidden(new Set(autoHidden ?? []));
        setFading(new Set());
        autoRef.current = { key: autoKey, ids: new Set(autoHidden ?? []), subject };
    }
    useEffect(
        () => () => {
            for (const t of fadeTimers.current.values()) window.clearTimeout(t);
        },
        []
    );
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
    // the Elo axis fits the lines not hidden by hand; ones a filter crossed off
    // still count, so moving the filter never rescales the rest
    const handHidden = (id: string) => hidden.has(id) && !autoRef.current.ids.has(id);
    const shown = useMemo(
        () => lines.filter((l) => !handHidden(l.id)).map((l) => l.points),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [lines, hidden, autoKey]
    );
    const hiddenCount = lines.filter((l) => hidden.has(l.id)).length;
    const handHiddenCount = lines.filter((l) => handHidden(l.id)).length;

    // Each line keeps its colour while others come and go: a new line takes
    // the colour fewest lines on the chart are using
    const colorIndex = useRef(new Map<string, number>());
    const colorOf = useMemo(() => {
        const used = new Array(ink.palette.length).fill(0);
        const ids = drawn.filter((s) => s.id !== ANNOTATIONS).map((s) => s.id);
        for (const id of ids) {
            const i = colorIndex.current.get(id);
            if (i !== undefined) used[i]++;
        }
        for (const id of ids) {
            if (colorIndex.current.has(id)) continue;
            const i = used.indexOf(Math.min(...used));
            colorIndex.current.set(id, i);
            used[i]++;
        }
        return (id: string) => ink.palette[(colorIndex.current.get(id) ?? 0) % ink.palette.length];
    }, [drawn, ink]);

    // the same names and colours as the legend, for the line search
    const finderLines = useMemo(
        () =>
            series
                .filter((s) => s.id !== ANNOTATIONS)
                .map((s) => ({ id: s.id, label: s.label, color: colorOf(s.id) })),
        [series, colorOf]
    );
    const offLines = useMemo(() => new Set([...hidden, ...fading]), [hidden, fading]);
    // the legend crosses a line off the moment it starts fading, in its own colour
    const legendRef = useRef({ off: offLines, leaving, colorOf });
    legendRef.current = { off: offLines, leaving, colorOf };

    // hiding fades a line out first; showing draws it back in
    const hideLines = (ids: string[]) => {
        if (reduced) {
            setHidden((prev) => new Set([...prev, ...ids]));
            return;
        }
        setFading((prev) => new Set([...prev, ...ids]));
        for (const id of ids) {
            window.clearTimeout(fadeTimers.current.get(id));
            fadeTimers.current.set(
                id,
                window.setTimeout(() => {
                    fadeTimers.current.delete(id);
                    setHidden((prev) => new Set([...prev, id]));
                    setFading((prev) => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }, FADE_MS)
            );
        }
    };
    const showLines = (ids: string[]) => {
        for (const id of ids) {
            window.clearTimeout(fadeTimers.current.get(id));
            fadeTimers.current.delete(id);
            // one that was fully off draws back in; one still fading just fades back
            if (!reduced && hidden.has(id)) revealRef.current.set(id, null);
        }
        const drop = (prev: ReadonlySet<string>) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        };
        setHidden(drop);
        setFading(drop);
    };
    const toggleLine = (id: string) => (offLines.has(id) ? showLines([id]) : hideLines([id]));

    // the filter moved: whoever it now leaves out fades and is crossed off,
    // whoever it lets back in draws back in; nobody else changes
    const lineOps = useRef({ hideLines, showLines });
    lineOps.current = { hideLines, showLines };
    useEffect(() => {
        const prev = autoRef.current;
        if (prev.key === autoKey || prev.subject !== subject) return;
        const next = new Set(autoHidden ?? []);
        const off = [...next].filter((id) => !prev.ids.has(id));
        const on = [...prev.ids].filter((id) => !next.has(id));
        autoRef.current = { key: autoKey, ids: next, subject };
        if (off.length) lineOps.current.hideLines(off);
        if (on.length) lineOps.current.showLines(on);
        // autoKey stands for autoHidden
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoKey, subject]);
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
        if (handHiddenCount > 0) return visibleDomain(shown, -Infinity, Infinity);
        return null;
    }, [shown, viewStart, viewEnd, handHiddenCount]);
    const viewMin = domain ? domain.min : yMin;
    const viewMax = domain ? domain.max : yMax;

    const spanDays = win
        ? win.halfDays * 2
        : extent
          ? (extent.max - extent.min) / DAY
          : 0;
    const axis = timeAxis(spanDays);

    const lineCount = series.filter((s) => s.id !== ANNOTATIONS).length;
    const data = useMemo(() => {
        return {
            datasets: drawn.map((s) => {
                const isAnno = s.id === ANNOTATIONS;
                const color = colorOf(s.id);
                // on its way out: every colour goes clear over FADE_MS
                const out = !isAnno && (leaving.has(s.id) || fading.has(s.id));
                const clear = `${color}00`;
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
                    borderColor: isAnno ? ink.scarlet : out ? clear : color,
                    backgroundColor: isAnno ? ink.scarlet : out ? clear : `${color}22`,
                    ...(out ? { pointBackgroundColor: clear } : {}),
                    fill: !isAnno && lineCount <= 2,
                    hidden: hidden.has(s.id),
                    // a line on its way in draws from the left (the sweep plugin) rather than rising
                    ...(out
                        ? { animation: { duration: FADE_MS, easing: 'easeOutCubic' as const } }
                        : entering.has(s.id)
                          ? { animation: false as const }
                          : {}),
                    tension: 0.25,
                    // no overshoot between points, which shows when zoomed in
                    cubicInterpolationMode: 'monotone' as const,
                    borderWidth: isAnno ? 0 : lineCount > 8 ? 1.25 : 2,
                    // important dates: short upright ticks along the bottom, named on hover
                    pointRadius: isAnno ? 7 : s.data.map((p) => (noDot(p) ? 0 : radius)),
                    pointHoverRadius: isAnno ? 9 : s.data.map((p) => (noDot(p) ? 3 : 5)),
                    pointStyle: isAnno ? ('line' as const) : ('circle' as const),
                    pointRotation: isAnno ? 90 : 0,
                    pointBorderWidth: isAnno ? 2 : 1,
                    pointHoverBorderWidth: isAnno ? 3 : 1,
                    pointBorderColor: isAnno ? `${ink.scarlet}bf` : out ? clear : color,
                    showLine: !isAnno,
                    spanGaps: false,
                };
            }),
        };
    }, [drawn, viewMin, zoom.level, hidden, ink, colorOf, leaving, fading, entering, lineCount]);

    const chartDuration = reduced ? 0 : CHANGE_MS;

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: chartDuration,
                // eases in and out, so zooms and rescales glide rather than snap
                easing: 'easeInOutCubic',
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
                    display: lineCount > 1,
                    // clicking a name crosses it off (or brings it back)
                    onClick: (_event, item) => {
                        const id = drawnRef.current[item.datasetIndex ?? -1]?.id;
                        if (id && id !== ANNOTATIONS && !leavingRef.current.has(id)) toggleLine(id);
                    },
                    labels: {
                        generateLabels: (chart) =>
                            ChartJS.defaults.plugins.legend.labels.generateLabels(chart).map((item) => {
                                const id = (chart.data.datasets[item.datasetIndex ?? -1] as { id?: string } | undefined)?.id;
                                const { off, leaving: gone, colorOf: col } = legendRef.current;
                                if (!id || id === ANNOTATIONS || (!off.has(id) && !gone.has(id))) return item;
                                const c = col(id);
                                return { ...item, hidden: true, fillStyle: `${c}22`, strokeStyle: c };
                            }),
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
                        boxHeight: 10,
                        color: ink.tick,
                        font: { family: ink.font, size: 12, weight: 500 },
                    },
                },
                // tooltips are posted on the scoreboard: black in both themes
                tooltip: {
                    backgroundColor: '#000',
                    borderColor: 'rgba(255,255,255,0.14)',
                    borderWidth: 1,
                    cornerRadius: 4,
                    padding: 10,
                    titleColor: '#a6a8b0',
                    bodyColor: '#f3f3f1',
                    titleFont: { family: ink.font, size: 12, weight: 500 },
                    bodyFont: { family: ink.font, size: 13, weight: 600 },
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
                    grid: { color: ink.grid },
                    border: { color: ink.grid },
                    ticks: { maxRotation: 0, color: ink.tick, font: { family: ink.font, size: 12 } },
                    title: { display: false },
                },
                y: {
                    min: viewMin ?? undefined,
                    max: viewMax ?? undefined,
                    grid: { color: ink.grid },
                    border: { display: false },
                    // only round numbers on the axis, not the padded ends
                    ticks: { color: ink.tick, includeBounds: false, font: { family: ink.font, size: 12 } },
                    title: { display: true, text: 'Elo', color: ink.tick, font: { family: ink.font, size: 12 } },
                },
            },
        }),
        // toggleLine changes every render; the legend reads the latest through drawnRef
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [lineCount, viewMin, viewMax, chartDuration, viewStart, viewEnd, axis.unit, axis.format, ink, offLines]
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
                            <Chevron dir="left" />
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
                            <Chevron dir="right" />
                        </button>
                    </span>
                ) : (
                    <span className="chart-zoom__label chart-zoom__label--idle" aria-live="polite">
                        All time
                    </span>
                )}
                <span className="chart-zoom__actions">
                    {/* finding and hiding lines pays off on a crowded chart; a few lines toggle from the legend */}
                    {lines.length > 4 && (
                        <>
                            <LineFinder lines={finderLines} hidden={offLines} onToggle={toggleLine} />
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={offLines.size >= lines.length}
                                onClick={() => hideLines(lines.map((l) => l.id).filter((id) => !offLines.has(id)))}
                            >
                                Hide all lines
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={offLines.size === 0}
                                onClick={() => showLines([...offLines])}
                            >
                                Show all lines
                            </button>
                        </>
                    )}
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
                <Line
                    data={data}
                    options={options}
                    plugins={[sweepPlugin]}
                    // lines are matched by id, so the ones that stay keep their place
                    datasetIdKey="id"
                    updateMode={instant ? 'none' : undefined}
                />
            </div>
            <div className="chart-footer">
                <p className="chart-zoom__hint">
                    {lines.length > 1 && hiddenCount === lines.length ? (
                        'Click names above the chart, or find one, to bring lines back'
                    ) : onPointClick ? (
                        'Click a point to delete it'
                    ) : (
                        <>
                            <span className="hint-pointer">
                                Click a point to zoom in, double-click to zoom out.
                                {lines.length > 1 ? ' Click a name to hide it.' : ''}
                            </span>
                            <span className="hint-touch">
                                Tap a point to zoom in.
                                {lines.length > 1 ? ' Tap a name to hide it.' : ''}
                            </span>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <path
                d={dir === 'left' ? 'M8.5 3 4.5 7l4 4' : 'M5.5 3l4 4-4 4'}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
