import { seasonOf } from './replay';
import type { Tournament } from './types';

/**
 * The latest season with any tournament results ("2025-26"). Until this
 * season's results go in, that's last season; with no results at all it's
 * the season we're in.
 */
export function latestSeason(tournaments: { date: string }[], today: string): string {
    let latest = '';
    for (const t of tournaments) if (t.date > latest) latest = t.date;
    return seasonOf(latest || today);
}

/** Everyone with a tournament result in a season: the people counted as active. */
export function competedIn(tournaments: Tournament[], season: string): Set<string> {
    const ids = new Set<string>();
    for (const t of tournaments) {
        if (seasonOf(t.date) !== season) continue;
        for (const p of t.tournament_participants) {
            ids.add(p.debater_id);
            if (p.partner_id) ids.add(p.partner_id);
        }
    }
    return ids;
}

/** The season before: "2025-26" for "2026-27". */
export function previousSeason(season: string): string {
    const y = Number(season.slice(0, 4)) - 1;
    return `${y}-${String(y + 1).slice(2)}`;
}

/** Everyone with a tournament result in any of these seasons. */
export function competedInAny(tournaments: Tournament[], seasons: string[]): Set<string> {
    const ids = new Set<string>();
    for (const s of seasons) for (const id of competedIn(tournaments, s)) ids.add(id);
    return ids;
}

/** "2025–26" for labels. */
export const seasonLabel = (season: string) => season.replace('-', '–');
