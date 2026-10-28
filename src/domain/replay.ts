import { calculatePracticeElo, calculateTournamentElo, pairingElo } from './elo';
import type { Division, HistoryPoint, TournamentParams } from './types';

/**
 * Rebuild everyone's Elo from scratch by running every practice round and
 * tournament in date order through the same math the app uses when results
 * are recorded one at a time.
 */

export interface ReplayPerson {
    id: string;
    startElo: number;
    /** Date of the first history point (before any results). */
    startDate: string;
    /**
     * Seasons ("2025-26") this person was on the roster. On-roster people who
     * skip a tournament get a flat history point for it, like the app adds.
     */
    rosterSeasons?: string[];
}

export interface ReplayEntry {
    id: string;
    /** One or two people. One means the partner isn't on record. */
    members: string[];
    division: Division;
    rawWins: number;
    rounds?: number;
}

export interface ReplayTournament {
    id: string;
    date: string;
    params: TournamentParams;
    entries: ReplayEntry[];
}

export interface ReplayPractice {
    id: string;
    date: string;
    winner: string[];
    loser: string[];
}

export interface ReplayEntryResult {
    teamElo: number;
    adjustedWins: number;
    change: number;
    rounds: number;
}

export interface ReplayResult {
    elo: Record<string, number>;
    history: Record<string, HistoryPoint[]>;
    tournaments: Record<
        string,
        { eTourney: number; entries: Record<string, ReplayEntryResult> }
    >;
    practice: Record<
        string,
        {
            winnerElo: number;
            loserElo: number;
            winnerChange: number;
            loserChange: number;
        }
    >;
}

/** "2025-26" for any date from July 2025 through June 2026. */
export function seasonOf(date: string): string {
    const y = Number(date.slice(0, 4));
    const m = Number(date.slice(5, 7));
    const start = m >= 7 ? y : y - 1;
    return `${start}-${String(start + 1).slice(2)}`;
}

type Event =
    | { kind: 'practice'; date: string; order: number; p: ReplayPractice }
    | { kind: 'tournament'; date: string; order: number; t: ReplayTournament };

export function replay(input: {
    people: ReplayPerson[];
    tournaments: ReplayTournament[];
    practice: ReplayPractice[];
}): ReplayResult {
    const elo: Record<string, number> = {};
    const history: Record<string, HistoryPoint[]> = {};
    const people = new Map(input.people.map((p) => [p.id, p]));
    for (const p of input.people) {
        elo[p.id] = p.startElo;
        history[p.id] = [{ date: p.startDate, elo: p.startElo }];
    }

    const need = (id: string) => {
        if (!(id in elo)) throw new Error(`Unknown person in replay: ${id}`);
    };

    const events: Event[] = [
        ...input.practice.map(
            (p, i): Event => ({ kind: 'practice', date: p.date, order: i, p })
        ),
        ...input.tournaments.map(
            (t, i): Event => ({ kind: 'tournament', date: t.date, order: i, t })
        ),
    ].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.kind !== b.kind) return a.kind === 'practice' ? -1 : 1;
        return a.order - b.order;
    });

    const out: ReplayResult = { elo, history, tournaments: {}, practice: {} };

    for (const ev of events) {
        if (ev.kind === 'practice') {
            const { p } = ev;
            [...p.winner, ...p.loser].forEach(need);
            const w = pairingElo(p.winner.map((id) => elo[id]));
            const l = pairingElo(p.loser.map((id) => elo[id]));
            const r = calculatePracticeElo(w, l);
            for (const id of p.winner) {
                elo[id] += r.winnerChange;
                history[id].push({ date: p.date, elo: elo[id] });
            }
            for (const id of p.loser) {
                elo[id] += r.loserChange;
                history[id].push({ date: p.date, elo: elo[id] });
            }
            out.practice[p.id] = {
                winnerElo: w,
                loserElo: l,
                winnerChange: r.winnerChange,
                loserChange: r.loserChange,
            };
            continue;
        }

        const { t } = ev;
        const inputs = t.entries.map((e) => {
            e.members.forEach(need);
            return {
                id: e.id,
                name: e.id,
                elo: pairingElo(e.members.map((id) => elo[id])),
                division: e.division,
                W_raw: e.rawWins,
                n: e.rounds,
            };
        });
        const { eTourney, results } = calculateTournamentElo(inputs, t.params);
        const entries: Record<string, ReplayEntryResult> = {};
        const played = new Set<string>();
        results.forEach((res, i) => {
            const entry = t.entries[i];
            entries[entry.id] = {
                teamElo: res.oldElo,
                adjustedWins: res.W_adjusted,
                change: res.change,
                rounds: res.n,
            };
            for (const id of entry.members) {
                elo[id] += res.change;
                history[id].push({ date: t.date, elo: elo[id], event: 'Tournament' });
                played.add(id);
            }
        });
        // Flat point for everyone on the roster who sat this one out
        const season = seasonOf(t.date);
        for (const [id, person] of people) {
            if (played.has(id)) continue;
            if (!person.rosterSeasons?.includes(season)) continue;
            if (person.startDate > t.date) continue;
            const h = history[id];
            if (h[h.length - 1]?.date === t.date) continue;
            h.push({ date: t.date, elo: elo[id], event: 'Tournament' });
        }
        out.tournaments[t.id] = { eTourney, entries };
    }

    return out;
}
