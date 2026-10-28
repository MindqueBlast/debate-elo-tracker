import { supabase } from './supabase';
import {
    computeAll,
    diffDerived,
    findTeam,
    getLocalDateString,
    seasonOf,
    validatePlayerName,
    validateTournamentParams,
    withoutPerson,
    type Debater,
    type Derived,
    type DerivedEntry,
    type Division,
    type InputAdjustment,
    type InputEntry,
    type InputPerson,
    type InputPractice,
    type Inputs,
    type InputTournament,
    type Pairing,
    type Team,
    type Tournament,
    type TournamentParams,
} from '../domain';
import type { AppSnapshot } from './loaders';

export class MutationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MutationError';
    }
}

// ----------------------------------------------------------- saving changes

type DateName = { date: string; name: string };

/** The stored facts a save adds, changes or removes. */
interface Changes {
    people_upsert?: InputPerson[];
    people_delete?: string[];
    tournaments_upsert?: Omit<InputTournament, 'entries'>[];
    tournaments_delete?: string[];
    entries_upsert?: (InputEntry & { tournament_id: string })[];
    entries_delete?: string[];
    practice_upsert?: InputPractice[];
    practice_delete?: string[];
    adjustments_upsert?: InputAdjustment[];
    adjustments_delete?: string[];
    annotations_insert?: DateName[];
    annotations_delete?: DateName[];
}

/**
 * Save a change. Everything is recalculated from the very beginning with the
 * change in place, then the change and every number that moved are stored in
 * one go: all of it saves or none of it does. If someone else saved since this
 * page loaded, nothing is written and the person is asked to refresh.
 */
async function commit(
    data: AppSnapshot,
    next: Inputs,
    changes: Changes,
    failMessage: string
): Promise<Derived> {
    const derived = computeAll(next, getLocalDateString());
    const moved = diffDerived(derived, data.stored);
    const { error } = await supabase.rpc('apply_changes', {
        payload: {
            revision: data.revision,
            ...changes,
            derived: {
                people: Object.entries(moved.people).map(([id, p]) => ({
                    id,
                    elo: p.elo,
                    history: p.history,
                })),
                entries: Object.entries(moved.entries).map(([id, e]) => ({ id, ...e })),
                tournaments: Object.entries(moved.tournaments).map(([id, t]) => ({ id, ...t })),
                practice: Object.entries(moved.practice).map(([id, r]) => ({ id, ...r })),
            },
        },
    });
    if (error) {
        if (error.message?.includes('stale_data')) {
            throw new MutationError(
                'Someone else saved a change since this page loaded. Refresh and try again.'
            );
        }
        throw new MutationError(failMessage);
    }
    return derived;
}

const newId = () => crypto.randomUUID();

const replaceById = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id)
        ? list.map((x) => (x.id === item.id ? item : x))
        : [...list, item];

function personInput(data: AppSnapshot, id: string): InputPerson {
    const p = data.inputs.people.find((x) => x.id === id);
    if (!p) throw new MutationError('That person is no longer on the roster. Refresh and try again.');
    return p;
}

// ---------------------------------------------------------------- people

const validClassYear = (y: number | null | undefined) =>
    y == null || (Number.isInteger(y) && y >= 2000 && y <= 2100);

export async function addDebater(
    data: AppSnapshot,
    input: { name: string; division: Division; startingElo: number; classYear: number | null }
) {
    const nameError = validatePlayerName(input.name, data.debaters);
    if (nameError) throw new MutationError(nameError);
    if (!Number.isFinite(input.startingElo)) {
        throw new MutationError('Starting Elo must be a number.');
    }
    if (input.classYear == null || !validClassYear(input.classYear)) {
        throw new MutationError('Pick their class year (the year they graduate).');
    }
    const person: InputPerson = {
        id: newId(),
        name: input.name.trim(),
        division: input.division,
        status: 'active',
        graduation_date: null,
        class_year: input.classYear,
        start_elo: input.startingElo,
        start_date: getLocalDateString(),
    };
    await commit(
        data,
        { ...data.inputs, people: [...data.inputs.people, person] },
        { people_upsert: [person] },
        'Failed to add person.'
    );
}

export async function updateDebater(
    data: AppSnapshot,
    debater: Debater,
    patch: {
        name?: string;
        division?: Division | null;
        startElo?: number;
        startDate?: string;
        classYear?: number | null;
    }
) {
    const current = personInput(data, debater.id);
    const person: InputPerson = { ...current };
    if (patch.name !== undefined && patch.name.trim() !== current.name) {
        const nameError = validatePlayerName(patch.name, data.debaters, debater.id);
        if (nameError) throw new MutationError(nameError);
        person.name = patch.name.trim();
    }
    if (patch.division !== undefined) person.division = patch.division;
    if (patch.classYear !== undefined) {
        if (!validClassYear(patch.classYear)) throw new MutationError('Class year should look like 2027.');
        person.class_year = patch.classYear;
    }
    if (patch.startElo !== undefined) {
        if (!Number.isFinite(patch.startElo)) throw new MutationError('Starting Elo must be a number.');
        person.start_elo = patch.startElo;
    }
    if (patch.startDate !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.startDate)) {
            throw new MutationError('Pick a start date.');
        }
        person.start_date = patch.startDate;
    }
    await commit(
        data,
        { ...data.inputs, people: replaceById(data.inputs.people, person) },
        { people_upsert: [person] },
        'Failed to save changes.'
    );
}

/**
 * Take someone off the app completely. A partner keeps their shared results
 * (partner left blank); results that were only this person are removed, and
 * everyone is recalculated without them.
 */
export async function removeDebater(data: AppSnapshot, id: string) {
    personInput(data, id);
    const w = withoutPerson(data.inputs, id);
    const gone = data.inputs.tournaments.filter((t) => w.deletedTournamentIds.includes(t.id));
    await commit(
        data,
        w.inputs,
        {
            people_delete: [id],
            entries_upsert: w.changedEntries.map(({ tournamentId, entry }) => ({
                ...entry,
                tournament_id: tournamentId,
            })),
            entries_delete: w.deletedEntryIds,
            tournaments_delete: w.deletedTournamentIds,
            practice_delete: w.deletedPracticeIds,
            adjustments_delete: w.deletedAdjustmentIds,
            annotations_delete: gone
                .filter((t) => t.name)
                .map((t) => ({ date: t.date, name: t.name as string })),
        },
        'Failed to remove.'
    );
}

export async function toggleGraduate(data: AppSnapshot, debater: Debater) {
    const current = personInput(data, debater.id);
    const graduating = current.status === 'active';
    const person: InputPerson = {
        ...current,
        status: graduating ? 'graduated' : 'active',
        // graduation_date is a date column, so store today's date (not just the year)
        graduation_date: graduating ? getLocalDateString() : null,
    };
    await commit(
        data,
        { ...data.inputs, people: replaceById(data.inputs.people, person) },
        { people_upsert: [person] },
        'Failed to update status.'
    );
    if (graduating) {
        // A graduated person's teams come off the active list
        await supabase
            .from('teams')
            .update({ active: false })
            .or(`member1_id.eq.${debater.id},member2_id.eq.${debater.id}`);
    }
}

/**
 * Set someone's Elo by hand. It's stored as a one-off adjustment today (the
 * difference from their current Elo), so later recalculations keep it.
 */
export async function setDebaterElo(
    data: AppSnapshot,
    debater: Debater,
    newElo: number,
    note?: string
) {
    if (!Number.isFinite(newElo)) throw new MutationError('Invalid Elo value.');
    personInput(data, debater.id);
    const amount = newElo - debater.elo;
    if (Math.abs(amount) < 1e-9) return;
    const adj: InputAdjustment = {
        id: newId(),
        debater_id: debater.id,
        date: getLocalDateString(),
        amount,
        note: note?.trim() || null,
    };
    await commit(
        data,
        { ...data.inputs, adjustments: [...data.inputs.adjustments, adj] },
        { adjustments_upsert: [adj] },
        'Failed to set Elo.'
    );
}

export async function deleteAdjustment(data: AppSnapshot, id: string) {
    await commit(
        data,
        { ...data.inputs, adjustments: data.inputs.adjustments.filter((a) => a.id !== id) },
        { adjustments_delete: [id] },
        'Failed to remove the adjustment.'
    );
}

// ----------------------------------------------------------------- teams

function checkPair(ids: (string | null | undefined)[]): [string, string] {
    const [a, b] = ids;
    if (!a || !b) throw new MutationError('Pick two people.');
    if (a === b) throw new MutationError('Pick two different people.');
    return [a, b];
}

export async function createTeam(input: {
    members: (string | null)[];
    name: string;
    division: Division | null;
    teams: Team[];
}) {
    const [a, b] = checkPair(input.members);
    const existing = findTeam(input.teams, [a, b]);
    if (existing?.active) {
        throw new MutationError('These two are already a team.');
    }
    if (existing) {
        const { error } = await supabase
            .from('teams')
            .update({
                active: true,
                name: input.name.trim() || existing.name,
                division: input.division ?? existing.division,
                season: seasonOf(getLocalDateString()),
            })
            .eq('id', existing.id);
        if (error) throw new MutationError('Failed to save the team.');
        return;
    }
    const { error } = await supabase.from('teams').insert({
        member1_id: a,
        member2_id: b,
        name: input.name.trim() || null,
        division: input.division,
        season: seasonOf(getLocalDateString()),
        active: true,
    });
    if (error) throw new MutationError('Failed to save the team.');
}

export async function updateTeam(
    team: Team,
    patch: {
        name?: string;
        members?: (string | null)[];
        division?: Division | null;
        active?: boolean;
    },
    teams: Team[]
) {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name.trim() || null;
    if (patch.division !== undefined) update.division = patch.division;
    if (patch.active !== undefined) update.active = patch.active;
    if (patch.members) {
        const [a, b] = checkPair(patch.members);
        const clash = findTeam(
            teams.filter((t) => t.id !== team.id),
            [a, b]
        );
        if (clash?.active) {
            throw new MutationError('Those two are already a team.');
        }
        update.member1_id = a;
        update.member2_id = b;
    }
    const { error } = await supabase.from('teams').update(update).eq('id', team.id);
    if (error) throw new MutationError('Failed to save the team.');
}

export async function deleteTeam(team: Team) {
    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    if (error) throw new MutationError('Failed to delete the team.');
}

// -------------------------------------------------------- shared checks

function checkNoOverlap(sides: Pairing[]) {
    const seen = new Set<string>();
    for (const side of sides) {
        if (!side[0]) throw new MutationError('Pick someone for every entry.');
        for (const id of side) {
            if (!id) continue;
            if (seen.has(id)) {
                throw new MutationError('The same person can’t be on two sides.');
            }
            seen.add(id);
        }
    }
}

function checkKnown(data: AppSnapshot, ids: (string | null | undefined)[]) {
    const known = new Set(data.inputs.people.map((p) => p.id));
    for (const id of ids) {
        if (id && !known.has(id)) {
            throw new MutationError('Someone in this result is no longer on the roster.');
        }
    }
}

// --------------------------------------------------------- practice rounds

export async function recordPracticeRound(
    data: AppSnapshot,
    input: { winner: Pairing; loser: Pairing; date?: string }
) {
    checkPair(input.winner);
    checkPair(input.loser);
    checkNoOverlap([input.winner, input.loser]);
    checkKnown(data, [...input.winner, ...input.loser]);
    const round: InputPractice = {
        id: newId(),
        date: input.date || getLocalDateString(),
        winner_id: input.winner[0],
        winner_partner_id: input.winner[1],
        loser_id: input.loser[0],
        loser_partner_id: input.loser[1],
    };
    const derived = await commit(
        data,
        { ...data.inputs, practice: [...data.inputs.practice, round] },
        { practice_upsert: [round] },
        'Failed to save the round.'
    );
    const r = derived.practice[round.id];
    return [
        { id: round.winner_id, change: r?.winner_change ?? 0 },
        { id: round.winner_partner_id, change: r?.winner_partner_change ?? 0 },
        { id: round.loser_id, change: r?.loser_change ?? 0 },
        { id: round.loser_partner_id, change: r?.loser_partner_change ?? 0 },
    ].filter((x): x is { id: string; change: number } => !!x.id);
}

export async function deletePracticeRound(data: AppSnapshot, id: string) {
    await commit(
        data,
        { ...data.inputs, practice: data.inputs.practice.filter((r) => r.id !== id) },
        { practice_delete: [id] },
        'Failed to delete the round.'
    );
}

// ------------------------------------------------------------- tournaments

export interface TournamentEntryDraft {
    /** Becomes the entry's id when saved (existing entries keep theirs). */
    key: string;
    members: Pairing;
    division: Division;
    prelimWins: number;
    elimWins: number;
}

export interface TournamentDraft {
    /** A new tournament gets this id; editing keeps the tournament's own. */
    id: string;
    name: string;
    date: string;
    params: TournamentParams;
    roundsByDivision?: Partial<Record<Division, number>>;
    entries: TournamentEntryDraft[];
}

/** Break wins count double. */
export const rawWinsOf = (prelim: number, elim: number) => prelim + 2 * elim;

function draftInput(data: AppSnapshot, draft: TournamentDraft): InputTournament {
    const existing = data.inputs.tournaments.find((t) => t.id === draft.id);
    return {
        id: draft.id,
        date: draft.date || getLocalDateString(),
        name: draft.name.trim() || null,
        bonus: draft.params.b,
        affect: draft.params.k,
        max_gain: draft.params.maxGain,
        max_rounds: draft.params.maxRounds,
        created_at: existing?.created_at ?? null,
        entries: draft.entries.map((e) => {
            const kept = existing?.entries.find((x) => x.id === e.key);
            const sameMembers =
                kept && kept.debater_id === e.members[0] && (kept.partner_id ?? null) === e.members[1];
            return {
                id: e.key,
                debater_id: e.members[0],
                partner_id: e.members[1],
                // keep the saved team link unless the people changed
                team_id: sameMembers ? kept.team_id : null,
                division: e.division,
                raw_wins: rawWinsOf(e.prelimWins, e.elimWins),
                rounds: draft.roundsByDivision?.[e.division] ?? draft.params.n,
            };
        }),
    };
}

function withTournament(data: AppSnapshot, t: InputTournament): Inputs {
    return { ...data.inputs, tournaments: replaceById(data.inputs.tournaments, t) };
}

export interface TournamentPreview {
    eTourney: number;
    /** By draft entry key. */
    entries: Record<string, DerivedEntry>;
}

/**
 * Exactly what this tournament does, worked out from everyone's Elo going
 * into its date (so it's right for old dates and edits too).
 */
export function previewTournament(data: AppSnapshot, draft: TournamentDraft): TournamentPreview {
    const input = draftInput(data, draft);
    const derived = computeAll(withTournament(data, input), getLocalDateString());
    const entries: Record<string, DerivedEntry> = {};
    for (const e of input.entries) {
        if (derived.entries[e.id]) entries[e.id] = derived.entries[e.id];
    }
    return { eTourney: derived.tournaments[input.id]?.e_tourney ?? 0, entries };
}

/** Record a new tournament or save changes to an existing one. */
export async function saveTournament(
    data: AppSnapshot,
    draft: TournamentDraft,
    teams: Team[]
): Promise<TournamentPreview> {
    const active = data.debaters.filter((d) => d.status === 'active');
    const invalid = validateTournamentParams(draft.params, draft.entries.length, active.length);
    if (invalid) throw new MutationError(invalid);
    checkNoOverlap(draft.entries.map((e) => e.members));
    checkKnown(data, draft.entries.flatMap((e) => e.members));
    for (const e of draft.entries) {
        if (
            !Number.isFinite(e.prelimWins) ||
            !Number.isFinite(e.elimWins) ||
            e.prelimWins < 0 ||
            e.elimWins < 0
        ) {
            throw new MutationError('Please enter valid wins for every entry.');
        }
    }

    const input = draftInput(data, draft);
    // a fresh entry for a saved team gets linked to it
    for (const e of input.entries) {
        if (!e.team_id) e.team_id = findTeam(teams, [e.debater_id, e.partner_id])?.id ?? null;
    }
    const before = data.inputs.tournaments.find((t) => t.id === draft.id);
    const { entries, ...row } = input;
    const keptIds = new Set(entries.map((e) => e.id));

    const annotations_insert: DateName[] = [];
    const annotations_delete: DateName[] = [];
    if (!before) {
        if (row.name) annotations_insert.push({ date: row.date, name: row.name });
    } else if (before.name !== row.name || before.date !== row.date) {
        if (before.name) annotations_delete.push({ date: before.date, name: before.name });
        if (row.name) annotations_insert.push({ date: row.date, name: row.name });
    }

    const derived = await commit(
        data,
        withTournament(data, input),
        {
            tournaments_upsert: [row],
            entries_upsert: entries.map((e) => ({ ...e, tournament_id: row.id })),
            entries_delete: (before?.entries ?? []).filter((e) => !keptIds.has(e.id)).map((e) => e.id),
            annotations_insert,
            annotations_delete,
        },
        before ? 'Failed to save the tournament.' : 'Failed to record tournament results.'
    );
    const out: Record<string, DerivedEntry> = {};
    for (const e of entries) if (derived.entries[e.id]) out[e.id] = derived.entries[e.id];
    return { eTourney: derived.tournaments[row.id]?.e_tourney ?? 0, entries: out };
}

export async function deleteTournament(data: AppSnapshot, tournament: Tournament) {
    await commit(
        data,
        {
            ...data.inputs,
            tournaments: data.inputs.tournaments.filter((t) => t.id !== tournament.id),
        },
        {
            tournaments_delete: [tournament.id],
            annotations_delete: tournament.name
                ? [{ date: tournament.date, name: tournament.name }]
                : [],
        },
        'Failed to delete the tournament.'
    );
}

// ------------------------------------------------------------ annotations

export async function addAnnotation(date: string, name: string) {
    if (!date || !name.trim()) {
        throw new MutationError('Please pick a date and enter an event name.');
    }
    const { error } = await supabase
        .from('annotations')
        .insert({ date, name: name.trim() });
    if (error) throw new MutationError('Failed to add annotation.');
}

export async function removeAnnotation(id: string) {
    const { error } = await supabase.from('annotations').delete().eq('id', id);
    if (error) throw new MutationError('Failed to remove annotation.');
}

export async function editAnnotationDate(id: string, date: string) {
    const { error } = await supabase
        .from('annotations')
        .update({ date })
        .eq('id', id);
    if (error) throw new MutationError('Failed to edit date.');
}
