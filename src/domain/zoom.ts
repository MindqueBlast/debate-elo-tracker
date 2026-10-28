/**
 * Chart zoom windows. Clicking a point zooms one level in around it:
 * all → season → half season → quarter → month → week.
 *
 * A "year" is the debate season (Aug 1 – Jul 31) so a season is never split
 * across two views; halves and quarters line up with it (Aug–Jan / Feb–Jul,
 * then three-month blocks from August). Months are calendar months and weeks
 * run Monday–Sunday.
 */

export type ZoomLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const ZOOM_LEVEL_NAMES = ['All time', 'Season', 'Half season', 'Quarter', 'Month', 'Week'] as const;

export const MAX_ZOOM: ZoomLevel = 5;

export interface ZoomWindow {
    /** First day shown (YYYY-MM-DD). */
    start: string;
    /** First day after the window (exclusive). */
    end: string;
    label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

/** Year and month index after adding k months. */
function addMonths(y: number, m0: number, k: number): [number, number] {
    const total = y * 12 + m0 + k;
    return [Math.floor(total / 12), ((total % 12) + 12) % 12];
}

function monthRangeLabel(y1: number, m1: number, y2: number, m2: number): string {
    return y1 === y2
        ? `${MONTHS[m1]} – ${MONTHS[m2]} ${y2}`
        : `${MONTHS[m1]} ${y1} – ${MONTHS[m2]} ${y2}`;
}

export function zoomWindow(level: ZoomLevel, anchor: string): ZoomWindow | null {
    if (level === 0) return null;
    const [y, mo, d] = anchor.slice(0, 10).split('-').map(Number);
    const m0 = mo - 1;
    const seasonYear = m0 >= 7 ? y : y - 1;
    const monthsIntoSeason = (m0 - 7 + 12) % 12;

    if (level === 1) {
        return {
            start: iso(seasonYear, 7, 1),
            end: iso(seasonYear + 1, 7, 1),
            label: `${seasonYear}–${pad((seasonYear + 1) % 100)} season`,
        };
    }
    if (level === 2 || level === 3) {
        const size = level === 2 ? 6 : 3;
        const block = Math.floor(monthsIntoSeason / size);
        const [sy, sm] = addMonths(seasonYear, 7, block * size);
        const [ly, lm] = addMonths(sy, sm, size - 1);
        const [ey, em] = addMonths(sy, sm, size);
        return { start: iso(sy, sm, 1), end: iso(ey, em, 1), label: monthRangeLabel(sy, sm, ly, lm) };
    }
    if (level === 4) {
        const [ey, em] = addMonths(y, m0, 1);
        return { start: iso(y, m0, 1), end: iso(ey, em, 1), label: `${FULL_MONTHS[m0]} ${y}` };
    }
    // week, Monday to Sunday
    const day = new Date(Date.UTC(y, m0, d));
    const offset = (day.getUTCDay() + 6) % 7;
    const monday = new Date(day.getTime() - offset * 86_400_000);
    const sunday = new Date(monday.getTime() + 6 * 86_400_000);
    const next = new Date(monday.getTime() + 7 * 86_400_000);
    const fmt = (dt: Date) => iso(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
    const label = sameMonth
        ? `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`
        : `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`;
    return { start: fmt(monday), end: fmt(next), label };
}

/** A date in the window just before (-1) or after (1) the one around `anchor`. */
export function adjacentAnchor(level: ZoomLevel, anchor: string, dir: -1 | 1): string {
    const w = zoomWindow(level, anchor);
    if (!w) return anchor;
    if (dir === 1) return w.end;
    const [y, m, d] = w.start.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
    return iso(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate());
}
