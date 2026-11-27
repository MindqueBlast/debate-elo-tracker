/**
 * A save, as the facts it adds, changes or removes, and how to take one back.
 *
 * Every save goes into the change log with two halves: what it did (after)
 * and what would put things back (before, worked out here from the state just
 * before the save). Undoing saves the before half as a new change, then
 * everyone is recalculated as usual.
 */
import type { InputAdjustment, InputEntry, InputPerson, InputPractice, Inputs, InputTournament } from './rebuild';
import type { Team } from './types';

export type DateName = { date: string; name: string };
export type EntryRow = InputEntry & { tournament_id: string };
export type TournamentRow = Omit<InputTournament, 'entries'>;

export interface Changes {
    people_upsert?: InputPerson[];
    people_delete?: string[];
    teams_upsert?: Team[];
    teams_delete?: string[];
    tournaments_upsert?: TournamentRow[];
    tournaments_delete?: string[];
    entries_upsert?: EntryRow[];
    entries_delete?: string[];
    practice_upsert?: InputPractice[];
    practice_delete?: string[];
    adjustments_upsert?: InputAdjustment[];
    adjustments_delete?: string[];
    annotations_insert?: DateName[];
    annotations_delete?: DateName[];
}

/** Everything a save can touch. */
export interface State {
    inputs: Inputs;
    teams: Team[];
    annotations: DateName[];
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
const rowOf = ({ entries: _entries, ...row }: InputTournament): TournamentRow => row;
const entryRows = (inputs: Inputs): Map<string, EntryRow> => {
    const out = new Map<string, EntryRow>();
    for (const t of inputs.tournaments) for (const e of t.entries) out.set(e.id, { ...e, tournament_id: t.id });
    return out;
};
const sameDateName = (a: DateName, b: DateName) => a.date === b.date && a.name === b.name;

/** Leave out empty lists, so a logged change stays short. */
export function compact(c: Changes): Changes {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(c)) if (Array.isArray(v) && v.length) out[k] = v;
    return out as Changes;
}

export function isEmptyChanges(c: Changes): boolean {
    return Object.keys(compact(c)).length === 0;
}

/** The change that would put `state` back the way it is, once `changes` is saved on top of it. */
export function invertChanges(state: State, changes: Changes): Changes {
    const people = byId(state.inputs.people);
    const teams = byId(state.teams);
    const tournaments = byId(state.inputs.tournaments);
    const entries = entryRows(state.inputs);
    const practice = byId(state.inputs.practice);
    const adjustments = byId(state.inputs.adjustments);

    const inv: Required<Changes> = {
        people_upsert: [],
        people_delete: [],
        teams_upsert: [],
        teams_delete: [],
        tournaments_upsert: [],
        tournaments_delete: [],
        entries_upsert: [],
        entries_delete: [],
        practice_upsert: [],
        practice_delete: [],
        adjustments_upsert: [],
        adjustments_delete: [],
        annotations_insert: [],
        annotations_delete: [],
    };
    const restoreTeam = new Map<string, Team>();
    const restoreEntry = new Map<string, EntryRow>();

    for (const p of changes.people_upsert ?? []) {
        const was = people.get(p.id);
        if (was) inv.people_upsert.push(was);
        else inv.people_delete.push(p.id);
    }
    for (const id of changes.people_delete ?? []) {
        const was = people.get(id);
        if (!was) continue;
        inv.people_upsert.push(was);
        // the database drops their saved teams along with them
        for (const t of state.teams) {
            if (t.member1_id === id || t.member2_id === id) restoreTeam.set(t.id, t);
        }
    }
    for (const t of changes.teams_upsert ?? []) {
        const was = teams.get(t.id);
        if (was) restoreTeam.set(was.id, was);
        else inv.teams_delete.push(t.id);
    }
    for (const id of changes.teams_delete ?? []) {
        const was = teams.get(id);
        if (was) restoreTeam.set(id, was);
    }
    for (const t of changes.tournaments_upsert ?? []) {
        const was = tournaments.get(t.id);
        if (was) inv.tournaments_upsert.push(rowOf(was));
        else inv.tournaments_delete.push(t.id);
    }
    for (const id of changes.tournaments_delete ?? []) {
        const was = tournaments.get(id);
        if (!was) continue;
        inv.tournaments_upsert.push(rowOf(was));
        // its entries go with it
        for (const e of was.entries) restoreEntry.set(e.id, { ...e, tournament_id: id });
    }
    for (const e of changes.entries_upsert ?? []) {
        const was = entries.get(e.id);
        if (was) restoreEntry.set(was.id, was);
        else if (!inv.tournaments_delete.includes(e.tournament_id)) inv.entries_delete.push(e.id);
    }
    for (const id of changes.entries_delete ?? []) {
        const was = entries.get(id);
        if (was) restoreEntry.set(id, was);
    }
    for (const r of changes.practice_upsert ?? []) {
        const was = practice.get(r.id);
        if (was) inv.practice_upsert.push(was);
        else inv.practice_delete.push(r.id);
    }
    for (const id of changes.practice_delete ?? []) {
        const was = practice.get(id);
        if (was) inv.practice_upsert.push(was);
    }
    for (const a of changes.adjustments_upsert ?? []) {
        const was = adjustments.get(a.id);
        if (was) inv.adjustments_upsert.push(was);
        else inv.adjustments_delete.push(a.id);
    }
    for (const id of changes.adjustments_delete ?? []) {
        const was = adjustments.get(id);
        if (was) inv.adjustments_upsert.push(was);
    }
    for (const a of changes.annotations_insert ?? []) inv.annotations_delete.push(a);
    for (const a of changes.annotations_delete ?? []) {
        if (state.annotations.some((x) => sameDateName(x, a))) inv.annotations_insert.push(a);
    }
    inv.teams_upsert = [...restoreTeam.values()];
    inv.entries_upsert = [...restoreEntry.values()];
    return compact(inv);
}

/** `state` with `changes` saved, in the same order the database applies them. */
export function applyChanges(state: State, changes: Changes): State {
    const people = new Map(state.inputs.people.map((p) => [p.id, p]));
    for (const p of changes.people_upsert ?? []) people.set(p.id, p);

    const teams = new Map(state.teams.map((t) => [t.id, t]));
    for (const t of changes.teams_upsert ?? []) teams.set(t.id, t);

    const tournaments = new Map(state.inputs.tournaments.map((t) => [t.id, { ...t, entries: [...t.entries] }]));
    for (const row of changes.tournaments_upsert ?? []) {
        const was = tournaments.get(row.id);
        tournaments.set(row.id, { ...row, entries: was?.entries ?? [] });
    }
    const dropEntries = new Set(changes.entries_delete ?? []);
    for (const id of changes.tournaments_delete ?? []) tournaments.delete(id);
    for (const t of tournaments.values()) t.entries = t.entries.filter((e) => !dropEntries.has(e.id));
    for (const { tournament_id, ...e } of changes.entries_upsert ?? []) {
        for (const t of tournaments.values()) t.entries = t.entries.filter((x) => x.id !== e.id);
        const t = tournaments.get(tournament_id);
        if (t) t.entries.push(e);
    }

    const practice = new Map(state.inputs.practice.map((r) => [r.id, r]));
    for (const id of changes.practice_delete ?? []) practice.delete(id);
    for (const r of changes.practice_upsert ?? []) practice.set(r.id, r);

    const adjustments = new Map(state.inputs.adjustments.map((a) => [a.id, a]));
    for (const id of changes.adjustments_delete ?? []) adjustments.delete(id);
    for (const a of changes.adjustments_upsert ?? []) adjustments.set(a.id, a);

    for (const id of changes.teams_delete ?? []) teams.delete(id);
    for (const id of changes.people_delete ?? []) {
        people.delete(id);
        // the database's cascades
        for (const [tid, t] of teams) if (t.member1_id === id || t.member2_id === id) teams.delete(tid);
        for (const [rid, r] of practice) if (r.winner_id === id || r.loser_id === id) practice.delete(rid);
        for (const [aid, a] of adjustments) if (a.debater_id === id) adjustments.delete(aid);
        for (const t of tournaments.values()) t.entries = t.entries.filter((e) => e.debater_id !== id);
    }

    let annotations = state.annotations.filter(
        (a) => !(changes.annotations_delete ?? []).some((x) => sameDateName(x, a))
    );
    annotations = [...annotations, ...(changes.annotations_insert ?? [])];

    return {
        inputs: {
            people: [...people.values()],
            tournaments: [...tournaments.values()],
            practice: [...practice.values()],
            adjustments: [...adjustments.values()],
        },
        teams: [...teams.values()],
        annotations,
    };
}

// What a row looks like for comparing, without bookkeeping the database fills in
const plain = (x: object | undefined): string => {
    if (!x) return '';
    const { created_at: _c, ...rest } = x as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(rest).sort()) {
        const v = rest[k];
        // a tournament without the flag counts as rated
        sorted[k] = k === 'rated' ? v !== false : v === undefined ? null : v;
    }
    return JSON.stringify(sorted);
};

/**
 * Whether everything a logged change did is still as it left it. If a later
 * save touched the same rows, undoing this one would quietly undo that too,
 * so it's refused until the later one is undone first.
 */
export function stillAsSaved(state: State, after: Changes): boolean {
    const people = byId(state.inputs.people);
    const teams = byId(state.teams);
    const tournaments = byId(state.inputs.tournaments);
    const entries = entryRows(state.inputs);
    const practice = byId(state.inputs.practice);
    const adjustments = byId(state.inputs.adjustments);

    const matches = <T extends { id: string }>(list: T[] | undefined, now: Map<string, T | object>) =>
        (list ?? []).every((x) => plain(now.get(x.id)) === plain(x));
    const gone = (ids: string[] | undefined, now: Map<string, unknown>) => (ids ?? []).every((id) => !now.has(id));

    const tournamentRows = new Map([...tournaments].map(([id, t]) => [id, rowOf(t)]));
    return (
        matches(after.people_upsert, people) &&
        gone(after.people_delete, people) &&
        matches(after.teams_upsert, teams) &&
        gone(after.teams_delete, teams) &&
        matches(after.tournaments_upsert, tournamentRows) &&
        gone(after.tournaments_delete, tournaments) &&
        matches(after.entries_upsert, entries) &&
        gone(after.entries_delete, entries) &&
        matches(after.practice_upsert, practice) &&
        gone(after.practice_delete, practice) &&
        matches(after.adjustments_upsert, adjustments) &&
        gone(after.adjustments_delete, adjustments)
    );
}
