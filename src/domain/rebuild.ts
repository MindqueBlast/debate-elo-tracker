/**
 * The app stores only facts: who is on the roster (with a starting Elo and
 * date), every tournament entry, practice round and manual adjustment.
 * Everyone's Elo, history and per-result changes are always worked out from
 * those facts by replaying everything from the very beginning, so fixing an
 * old result fixes everything after it.
 */
import {
    replay,
    seasonOf,
    type ReplayAdjustment,
    type ReplayPerson,
    type ReplayPractice,
    type ReplayTournament,
} from './replay';
import type { DebaterStatus, Division, HistoryPoint } from './types';

// ------------------------------------------------------------------ inputs

export interface InputPerson {
    id: string;
    name: string;
    division: Division | null;
    status: DebaterStatus;
    graduation_date: string | null;
    class_year: number | null;
    start_elo: number;
    /** Before their first result. If a result is dated earlier, that date is used. */
    start_date: string;
    created_at?: string | null;
}

export interface InputEntry {
    id: string;
    debater_id: string;
    partner_id: string | null;
    team_id: string | null;
    division: Division;
    /** Prelim wins + 2 × elim wins (byes count as wins). */
    raw_wins: number;
    /** Prelim rounds for this entry's division. */
    rounds: number | null;
}

export interface InputTournament {
    id: string;
    date: string;
    name: string | null;
    bonus: number | null;
    affect: number | null;
    max_gain: number | null;
    max_rounds: number | null;
    created_at?: string | null;
    entries: InputEntry[];
}

export interface InputPractice {
    id: string;
    date: string;
    winner_id: string;
    winner_partner_id: string | null;
    loser_id: string;
    loser_partner_id: string | null;
    created_at?: string | null;
}

export interface InputAdjustment {
    id: string;
    debater_id: string;
    date: string;
    amount: number;
    note: string | null;
    created_at?: string | null;
}

export interface Inputs {
    people: InputPerson[];
    tournaments: InputTournament[];
    practice: InputPractice[];
    adjustments: InputAdjustment[];
}

// ----------------------------------------------------------------- results

export interface DerivedPerson {
    elo: number;
    history: HistoryPoint[];
}

export interface DerivedEntry {
    elo_change: number;
    partner_elo_change: number | null;
    adjusted_wins: number;
    /** The pair's average Elo going in. */
    team_elo: number;
}

export interface DerivedPractice {
    winner_change: number;
    loser_change: number;
    winner_partner_change: number | null;
    loser_partner_change: number | null;
}

export interface Derived {
    people: Record<string, DerivedPerson>;
    entries: Record<string, DerivedEntry>;
    tournaments: Record<string, { e_tourney: number }>;
    practice: Record<string, DerivedPractice>;
}

export const DEFAULT_PARAMS = { b: 0, k: 45, maxGain: 300, n: 6 } as const;

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;

/** Oldest first; on the same day, in the order they were added. */
function chronological<T extends { id: string; date: string; created_at?: string | null }>(
    a: T,
    b: T
): number {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    // not saved yet = added last
    const ca = a.created_at ?? '￿';
    const cb = b.created_at ?? '￿';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** "2023-24", "2024-25", … from one season to another, inclusive. */
export function seasonsBetween(from: string, to: string): string[] {
    const a = Number(from.slice(0, 4));
    const b = Number(to.slice(0, 4));
    const out: string[] = [];
    for (let y = a; y <= b; y++) out.push(`${y}-${String(y + 1).slice(2)}`);
    return out;
}

/**
 * When someone counts as on the team: from the season they started through
 * the season they graduated (or through now, if they're still active). On-team
 * people who skip a tournament get a flat point on their graph for it.
 */
function rosterSeasons(
    person: InputPerson,
    start: string,
    lastActivity: string | undefined,
    today: string
): string[] {
    const end =
        person.status === 'graduated'
            ? seasonOf(person.graduation_date ?? lastActivity ?? start)
            : seasonOf(today);
    return seasonsBetween(seasonOf(start), end);
}

export function computeAll(inputs: Inputs, today: string): Derived {
    const known = new Set(inputs.people.map((p) => p.id));
    const keep = (ids: (string | null | undefined)[]) =>
        ids.filter((id): id is string => !!id && known.has(id));

    const tournaments = [...inputs.tournaments].sort(chronological);
    const practice = [...inputs.practice].sort(chronological);
    const adjustments = [...inputs.adjustments]
        .filter((a) => known.has(a.debater_id))
        .sort(chronological);

    // First and last day each person did anything
    const first = new Map<string, string>();
    const last = new Map<string, string>();
    const saw = (id: string, date: string) => {
        if (!first.has(id) || date < first.get(id)!) first.set(id, date);
        if (!last.has(id) || date > last.get(id)!) last.set(id, date);
    };
    for (const t of tournaments) {
        for (const e of t.entries) keep([e.debater_id, e.partner_id]).forEach((id) => saw(id, t.date));
    }
    for (const r of practice) {
        keep([r.winner_id, r.winner_partner_id, r.loser_id, r.loser_partner_id]).forEach((id) =>
            saw(id, r.date)
        );
    }
    for (const a of adjustments) saw(a.debater_id, a.date);

    const people: ReplayPerson[] = inputs.people.map((p) => {
        const firstActive = first.get(p.id);
        const start = firstActive && firstActive < p.start_date ? firstActive : p.start_date;
        return {
            id: p.id,
            startElo: p.start_elo,
            startDate: start,
            rosterSeasons: rosterSeasons(p, start, last.get(p.id), today),
        };
    });

    const replayTournaments: ReplayTournament[] = tournaments.map((t) => {
        const entries = t.entries
            .map((e) => ({ e, members: keep([e.debater_id, e.partner_id]) }))
            .filter((x) => x.members.length > 0);
        const rounds = entries.map((x) => x.e.rounds).filter((r): r is number => r != null && r > 0);
        return {
            id: t.id,
            date: t.date,
            params: {
                n: rounds.length ? Math.max(...rounds) : DEFAULT_PARAMS.n,
                b: t.bonus ?? DEFAULT_PARAMS.b,
                k: t.affect ?? DEFAULT_PARAMS.k,
                maxGain: t.max_gain ?? DEFAULT_PARAMS.maxGain,
                maxRounds: t.max_rounds,
            },
            entries: entries.map(({ e, members }) => ({
                id: e.id,
                members,
                division: e.division,
                rawWins: e.raw_wins,
                rounds: e.rounds ?? undefined,
            })),
        };
    });

    const replayPractice: ReplayPractice[] = practice
        .map((r) => ({
            id: r.id,
            date: r.date,
            winner: keep([r.winner_id, r.winner_partner_id]),
            loser: keep([r.loser_id, r.loser_partner_id]),
        }))
        .filter((r) => r.winner.length > 0 && r.loser.length > 0);

    const replayAdjustments: ReplayAdjustment[] = adjustments.map((a) => ({
        id: a.id,
        date: a.date,
        person: a.debater_id,
        amount: a.amount,
        label: `Manual adjustment ${signed(a.amount)}${a.note ? ` (${a.note})` : ''}`,
    }));

    const result = replay({
        people,
        tournaments: replayTournaments,
        practice: replayPractice,
        adjustments: replayAdjustments,
    });

    const out: Derived = { people: {}, entries: {}, tournaments: {}, practice: {} };
    for (const p of people) {
        out.people[p.id] = { elo: result.elo[p.id], history: result.history[p.id] };
    }
    for (const t of tournaments) {
        const r = result.tournaments[t.id];
        if (!r) continue;
        out.tournaments[t.id] = { e_tourney: r.eTourney };
        for (const e of t.entries) {
            const res = r.entries[e.id];
            if (!res) continue;
            const a = known.has(e.debater_id) ? e.debater_id : null;
            const b = e.partner_id && known.has(e.partner_id) ? e.partner_id : null;
            out.entries[e.id] = {
                elo_change: a ? res.changes[a] : res.change,
                partner_elo_change: b ? res.changes[b] : null,
                adjusted_wins: res.adjustedWins,
                team_elo: res.teamElo,
            };
        }
    }
    for (const r of practice) {
        const res = result.practice[r.id];
        if (!res) continue;
        const of = (id: string | null) => (id && id in res.changes ? res.changes[id] : null);
        out.practice[r.id] = {
            winner_change: of(r.winner_id) ?? 0,
            loser_change: of(r.loser_id) ?? 0,
            winner_partner_change: of(r.winner_partner_id),
            loser_partner_change: of(r.loser_partner_id),
        };
    }
    return out;
}

// ------------------------------------------------------- what to write back

const TOLERANCE = 1e-7;

function same(a: number | null | undefined, b: number | null | undefined): boolean {
    if (a == null || b == null) return a == null && b == null;
    return Math.abs(a - b) <= TOLERANCE;
}

function sameHistory(a: HistoryPoint[], b: HistoryPoint[]): boolean {
    if (a.length !== b.length) return false;
    return a.every(
        (p, i) =>
            p.date === b[i].date &&
            (p.event ?? null) === (b[i].event ?? null) &&
            same(p.elo, b[i].elo)
    );
}

/** Only the numbers that differ from what's stored, so saves stay small. */
export function diffDerived(next: Derived, stored: Derived): Derived {
    const out: Derived = { people: {}, entries: {}, tournaments: {}, practice: {} };
    for (const [id, p] of Object.entries(next.people)) {
        const s = stored.people[id];
        if (!s || !same(p.elo, s.elo) || !sameHistory(p.history, s.history)) out.people[id] = p;
    }
    for (const [id, e] of Object.entries(next.entries)) {
        const s = stored.entries[id];
        if (
            !s ||
            !same(e.elo_change, s.elo_change) ||
            !same(e.partner_elo_change, s.partner_elo_change) ||
            !same(e.adjusted_wins, s.adjusted_wins) ||
            !same(e.team_elo, s.team_elo)
        ) {
            out.entries[id] = e;
        }
    }
    for (const [id, t] of Object.entries(next.tournaments)) {
        const s = stored.tournaments[id];
        if (!s || !same(t.e_tourney, s.e_tourney)) out.tournaments[id] = t;
    }
    for (const [id, r] of Object.entries(next.practice)) {
        const s = stored.practice[id];
        if (
            !s ||
            !same(r.winner_change, s.winner_change) ||
            !same(r.loser_change, s.loser_change) ||
            !same(r.winner_partner_change, s.winner_partner_change) ||
            !same(r.loser_partner_change, s.loser_partner_change)
        ) {
            out.practice[id] = r;
        }
    }
    return out;
}

export const isEmptyDerived = (d: Derived) =>
    Object.keys(d.people).length +
        Object.keys(d.entries).length +
        Object.keys(d.tournaments).length +
        Object.keys(d.practice).length ===
    0;

// ------------------------------------------------------------ removing people

export interface WithoutPerson {
    inputs: Inputs;
    /** Entries that keep the other partner, now on their own. */
    changedEntries: { tournamentId: string; entry: InputEntry }[];
    deletedEntryIds: string[];
    /** Tournaments left with nobody in them. */
    deletedTournamentIds: string[];
    deletedPracticeIds: string[];
    deletedAdjustmentIds: string[];
}

/**
 * Take someone out of every result. A partner keeps the result on their own
 * (partner unknown); results that were only this person go away.
 */
export function withoutPerson(inputs: Inputs, id: string): WithoutPerson {
    const changedEntries: WithoutPerson['changedEntries'] = [];
    const deletedEntryIds: string[] = [];
    const deletedTournamentIds: string[] = [];
    const tournaments: InputTournament[] = [];
    for (const t of inputs.tournaments) {
        const entries: InputEntry[] = [];
        for (const e of t.entries) {
            if (e.debater_id !== id && e.partner_id !== id) {
                entries.push(e);
                continue;
            }
            const other = e.debater_id === id ? e.partner_id : e.debater_id;
            if (!other) {
                deletedEntryIds.push(e.id);
                continue;
            }
            const solo = { ...e, debater_id: other, partner_id: null, team_id: null };
            entries.push(solo);
            changedEntries.push({ tournamentId: t.id, entry: solo });
        }
        if (entries.length === 0) {
            deletedTournamentIds.push(t.id);
            continue;
        }
        tournaments.push({ ...t, entries });
    }
    const involved = (r: InputPractice) =>
        [r.winner_id, r.winner_partner_id, r.loser_id, r.loser_partner_id].includes(id);
    const deletedPracticeIds = inputs.practice.filter(involved).map((r) => r.id);
    const deletedAdjustmentIds = inputs.adjustments
        .filter((a) => a.debater_id === id)
        .map((a) => a.id);
    return {
        inputs: {
            people: inputs.people.filter((p) => p.id !== id),
            tournaments,
            practice: inputs.practice.filter((r) => !involved(r)),
            adjustments: inputs.adjustments.filter((a) => a.debater_id !== id),
        },
        changedEntries,
        deletedEntryIds,
        deletedTournamentIds,
        deletedPracticeIds,
        deletedAdjustmentIds,
    };
}
