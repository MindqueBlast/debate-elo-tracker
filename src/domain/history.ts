import { graduationCutoffDate, isCalendarDate } from './dates';
import type { HistoryPoint } from './types';

export function sanitizeHistory(raw: unknown): HistoryPoint[] {
    if (!Array.isArray(raw)) return [];
    const points: HistoryPoint[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const date = typeof rec.date === 'string' ? rec.date.slice(0, 10) : '';
        const elo = typeof rec.elo === 'number' ? rec.elo : Number(rec.elo);
        if (!isCalendarDate(date) || !Number.isFinite(elo)) continue;
        const point: HistoryPoint = { date, elo };
        if (typeof rec.event === 'string' && rec.event) {
            point.event = rec.event;
        }
        points.push(point);
    }
    return sortHistory(points);
}

export function sortHistory(history: HistoryPoint[]): HistoryPoint[] {
    return [...history].sort((a, b) => {
        if (a.date === b.date) return 0;
        return a.date < b.date ? -1 : 1;
    });
}

export function appendHistory(
    history: HistoryPoint[],
    point: HistoryPoint
): HistoryPoint[] {
    return sortHistory([...history, point]);
}

export function filterHistoryByRange(
    history: HistoryPoint[],
    startDate?: string | null,
    endDate?: string | null
): HistoryPoint[] {
    if (!startDate && !endDate) return history;
    return history.filter((h) => {
        if (startDate && h.date < startDate) return false;
        if (endDate && h.date > endDate) return false;
        return true;
    });
}

export function filterHistoryByGraduation(
    history: HistoryPoint[],
    graduationDate: string | null
): HistoryPoint[] {
    const cutoff = graduationCutoffDate(graduationDate);
    if (!cutoff) return history;
    return history.filter((h) => h.date <= cutoff);
}

/** Remove the last point matching date (and optional event), preserving earlier same-day points. */
export function removeLastMatchingHistoryPoint(
    history: HistoryPoint[],
    date: string,
    event?: string
): HistoryPoint[] {
    const next = [...history];
    for (let i = next.length - 1; i >= 0; i--) {
        const pt = next[i];
        if (pt.date !== date) continue;
        if (event !== undefined && pt.event !== event) continue;
        next.splice(i, 1);
        break;
    }
    return next;
}

export function hasLaterHistory(
    history: HistoryPoint[],
    date: string
): boolean {
    return history.some((h) => h.date > date);
}

export function peakElo(history: HistoryPoint[], fallback: number): number {
    if (history.length === 0) return fallback;
    return Math.max(...history.map((h) => h.elo));
}

export function eloStdDev(history: HistoryPoint[]): number | null {
    if (history.length <= 1) return null;
    const elos = history.map((h) => h.elo);
    const mean = elos.reduce((a, b) => a + b, 0) / elos.length;
    const variance =
        elos.reduce((sum, v) => sum + (v - mean) ** 2, 0) / elos.length;
    return Math.sqrt(variance);
}
