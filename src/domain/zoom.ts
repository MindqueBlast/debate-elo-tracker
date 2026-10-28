/**
 * Chart zoom. Clicking a point zooms one step in, centred on that point:
 * all time → year → half year → quarter → month → week.
 */

export type ZoomLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const ZOOM_LEVEL_NAMES = ['All time', 'Year', 'Half year', 'Quarter', 'Month', 'Week'] as const;

export const MAX_ZOOM: ZoomLevel = 5;

/** Days shown at each level (odd, so the clicked day sits exactly in the middle). */
export const ZOOM_SPAN_DAYS = [0, 365, 183, 91, 31, 7] as const;

export interface ZoomWindow {
    /** The day in the middle (YYYY-MM-DD). */
    center: string;
    /** Days from the middle to either edge. */
    halfDays: number;
    /** First and last days shown. */
    first: string;
    last: string;
    /** e.g. "Feb 21 – 27, 2024" */
    label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

function parts(date: string): [number, number, number] {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    return [y, m - 1, d];
}

export function addDays(date: string, days: number): string {
    const [y, m0, d] = parts(date);
    const t = new Date(Date.UTC(y, m0, d) + days * DAY);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function rangeLabel(first: string, last: string): string {
    const [y1, m1, d1] = parts(first);
    const [y2, m2, d2] = parts(last);
    if (y1 !== y2) return `${MONTHS[m1]} ${d1}, ${y1} – ${MONTHS[m2]} ${d2}, ${y2}`;
    if (m1 !== m2) return `${MONTHS[m1]} ${d1} – ${MONTHS[m2]} ${d2}, ${y2}`;
    return `${MONTHS[m1]} ${d1} – ${d2}, ${y2}`;
}

export function zoomWindow(level: ZoomLevel, center: string): ZoomWindow | null {
    if (level === 0) return null;
    const span = ZOOM_SPAN_DAYS[level];
    const side = (span - 1) / 2;
    const first = addDays(center, -side);
    const last = addDays(center, side);
    return { center, halfDays: span / 2, first, last, label: rangeLabel(first, last) };
}

/** The middle of the window just before (-1) or after (1) this one. */
export function shiftCenter(level: ZoomLevel, center: string, dir: -1 | 1): string {
    return level === 0 ? center : addDays(center, dir * ZOOM_SPAN_DAYS[level]);
}
