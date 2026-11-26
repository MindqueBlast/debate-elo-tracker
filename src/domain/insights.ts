import { seasonOf } from './replay';
import type { Debater, HistoryPoint } from './types';

/**
 * The chance side A beats side B on ratings alone, read the standard Elo way:
 * a 400-point gap is about 10 to 1.
 */
export function winChance(a: number, b: number): number {
    return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** The first day of a season ('2026-27' starts 2026-07-01, as seasonOf counts it). */
export const seasonStart = (season: string) => `${season.slice(0, 4)}-07-01`;

/** Someone's rating going into a day: after every result before it, or where they started. */
export function eloBefore(history: HistoryPoint[], startElo: number, day: string): number {
    let elo = startElo;
    for (const h of history) {
        if (h.date >= day) break;
        elo = h.elo;
    }
    return elo;
}

export interface Mover {
    id: string;
    name: string;
    from: number;
    to: number;
    change: number;
}

/** How far each person has moved this season, biggest climb first. */
export function seasonMovers(debaters: Debater[], ids: ReadonlySet<string>, season: string): Mover[] {
    const start = seasonStart(season);
    return debaters
        .filter((d) => ids.has(d.id))
        .map((d) => {
            const sorted = [...d.history].sort((a, b) => a.date.localeCompare(b.date));
            const from = eloBefore(sorted, d.start_elo, start);
            return { id: d.id, name: d.name, from, to: d.elo, change: d.elo - from };
        })
        .sort((a, b) => b.change - a.change || a.name.localeCompare(b.name));
}

/** People whose rating today is the highest it has ever been (and who have played). */
export function atPersonalBest(debaters: Debater[], ids: ReadonlySet<string>): Debater[] {
    return debaters
        .filter((d) => ids.has(d.id) && d.history.length > 0)
        .filter((d) => d.elo >= Math.max(...d.history.map((h) => h.elo)) - 1e-9)
        .sort((a, b) => b.elo - a.elo);
}

export interface SeasonRow {
    season: string;
    start: number;
    end: number;
    change: number;
    peak: number;
    tournaments: number;
    best: { name: string; change: number } | null;
}

/**
 * One row per season someone played: where they started and finished, their
 * peak, how many tournaments, and their biggest single gain.
 */
export function seasonBreakdown(
    history: HistoryPoint[],
    startElo: number,
    results: { date: string; name: string; change: number }[]
): SeasonRow[] {
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const seasons = [...new Set(results.map((r) => seasonOf(r.date)))].sort();
    return seasons
        .map((season) => {
            const start = seasonStart(season);
            const next = `${Number(season.slice(0, 4)) + 1}-07-01`;
            const from = eloBefore(sorted, startElo, start);
            const inSeason = sorted.filter((h) => h.date >= start && h.date < next);
            const end = inSeason.length ? inSeason[inSeason.length - 1].elo : from;
            const played = results.filter((r) => r.date >= start && r.date < next);
            const best = played.reduce<{ name: string; change: number } | null>(
                (b, r) => (r.change > 0 && (!b || r.change > b.change) ? { name: r.name, change: r.change } : b),
                null
            );
            return {
                season,
                start: from,
                end,
                change: end - from,
                peak: Math.max(from, ...inSeason.map((h) => h.elo)),
                tournaments: played.length,
                best,
            };
        })
        .reverse();
}
