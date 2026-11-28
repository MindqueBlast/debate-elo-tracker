import { supabase } from './supabase';
import {
    applyChanges,
    compact,
    computeAll,
    diffDerived,
    getEloConfig,
    invertChanges,
    isEmptyChanges,
    mergeChanges,
    newSeasonChanges,
    scoringRewrite,
    startEloFixes,
    stillAsSaved,
    validateConfig,
    withEloConfig,
    type Changes,
    type EloConfig,
    type State,
    findTeam,
    getLocalDateString,
    seasonOf,
    validatePlayerName,
    validateTournamentParams,
    withoutPerson,
    type Debater,
    type DateName,
    type Derived,
    type DerivedEntry,
    type Division,
    type InputAdjustment,
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

/** Who's saving, for the change log (set when someone signs in). */
let actor: string | null = null;
export function setActor(email: string | null) {
    actor = email ? email.trim().toLowerCase() : null;
}

export interface CommitOptions {
    /** What the change log calls this ("Recorded Harvard"). Without one, nothing is logged. */
    action?: string;
    /** False for changes the log can't take back (scoring settings, restores). */
    undoable?: boolean;
    /** Take a backup of everything first, with this reason. */
    snapshot?: string;
    /** The admin password, for saves that need it. */
    password?: string;
    requirePassword?: boolean;
    /** A setting saved along with the change (needs the password). */
    settings?: { key: string; value: unknown };
    /** The logged change this one takes back. */
    undoes?: string;
    /** Work the numbers out under these settings instead of the current ones. */
    config?: EloConfig;
}

/** The state a save starts from, for working out how to undo it. */
export const stateOf = (data: AppSnapshot): State => ({
    inputs: data.inputs,
    teams: data.teams,
    annotations: data.annotations.map(({ date, name }) => ({ date, name })),
});

/** The database's own words for the errors people can act on. */
function saveError(message: string | undefined, fallback: string): MutationError {
    const m = message ?? '';
    if (m.includes('stale_data')) {
        return new MutationError('Someone else saved a change since this page loaded. Refresh and try again.');
    }
    if (m.includes('already_undone')) return new MutationError('That change was already undone.');
    for (const known of ['Wrong password.', 'No admin password has been set yet.', 'Only admins can do that.']) {
        if (m.includes(known)) return new MutationError(known);
    }
    return new MutationError(fallback);
}

/**
 * Save a change. Everything is recalculated from the very beginning with the
 * change in place, then the change and every number that moved are stored in
 * one go: all of it saves or none of it does. If someone else saved since this
 * page loaded, nothing is written and the person is asked to refresh. With an
 * action, the change goes in the change log along with how to undo it.
 */
async function commit(
    data: AppSnapshot,
    next: Inputs,
    changes: Changes,
    failMessage: string,
    opts: CommitOptions = {}
): Promise<Derived> {
    const derived = withEloConfig(opts.config ?? getEloConfig(), () => computeAll(next, getLocalDateString()));
    const moved = diffDerived(derived, data.stored);
    const { error } = await supabase.rpc('apply_changes', {
        payload: {
            revision: data.revision,
            actor,
            ...compact(changes),
            ...(opts.snapshot ? { snapshot: opts.snapshot } : {}),
            ...(opts.settings ? { settings: opts.settings } : {}),
            ...(opts.password !== undefined ? { password: opts.password } : {}),
            ...(opts.requirePassword ? { require_password: true } : {}),
            ...(opts.action
                ? {
                      log: {
                          action: opts.action,
                          before: invertChanges(stateOf(data), changes),
                          after: compact(changes),
                          undoable: opts.undoable !== false,
                          ...(opts.undoes ? { undoes: opts.undoes } : {}),
                      },
                  }
                : {}),
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
    if (error) throw saveError(error.message, failMessage);
    return derived;
}

const newId = () => crypto.randomUUID();

/** "Jiayi+Leon", for log entries. */
function namesOf(data: AppSnapshot, ids: (string | null | undefined)[]): string {
    const names = new Map(data.inputs.people.map((p) => [p.id, p.name]));
    return ids
        .filter((id): id is string => !!id)
        .map((id) => names.get(id) ?? 'someone')
        .join('+');
}

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
        'Failed to add person.',
        { action: `Added ${person.name}` }
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
        'Failed to save changes.',
        { action: `Edited ${person.name}` }
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
        'Failed to remove.',
        { action: `Removed ${namesOf(data, [id])}` }
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
        'Failed to update status.',
        { action: graduating ? `Graduated ${person.name}` : `Made ${person.name} active again` }
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
        'Failed to set Elo.',
        { action: `Set ${debater.name}’s Elo to ${Math.round(newElo)}` }
    );
}

export async function deleteAdjustment(data: AppSnapshot, id: string) {
    const who = data.inputs.adjustments.find((a) => a.id === id)?.debater_id;
    await commit(
        data,
        { ...data.inputs, adjustments: data.inputs.adjustments.filter((a) => a.id !== id) },
        { adjustments_delete: [id] },
        'Failed to remove the adjustment.',
        { action: `Removed an Elo adjustment for ${namesOf(data, [who])}` }
    );
}

/** Take back several manual Elo changes in one save (e.g. all of someone's). */
export async function deleteAdjustments(data: AppSnapshot, ids: string[]) {
    const drop = new Set(ids);
    const gone = data.inputs.adjustments.filter((a) => drop.has(a.id));
    if (!gone.length) return;
    const who = [...new Set(gone.map((a) => a.debater_id))];
    await commit(
        data,
        { ...data.inputs, adjustments: data.inputs.adjustments.filter((a) => !drop.has(a.id)) },
        { adjustments_delete: gone.map((a) => a.id) },
        'Failed to remove the manual changes.',
        {
            action:
                gone.length === 1
                    ? `Removed an Elo adjustment for ${namesOf(data, who)}`
                    : `Removed ${gone.length} manual Elo changes (${who.map((id) => namesOf(data, [id])).join(', ')})`,
        }
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
        'Failed to save the round.',
        { action: `Recorded a practice round: ${namesOf(data, input.winner)} def. ${namesOf(data, input.loser)}` }
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
    const r = data.inputs.practice.find((x) => x.id === id);
    await commit(
        data,
        { ...data.inputs, practice: data.inputs.practice.filter((r) => r.id !== id) },
        { practice_delete: [id] },
        'Failed to delete the round.',
        {
            action: r
                ? `Deleted a practice round: ${namesOf(data, [r.winner_id, r.winner_partner_id])} def. ${namesOf(data, [r.loser_id, r.loser_partner_id])}`
                : 'Deleted a practice round',
        }
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
    /** Lost at least one round, prelims or elims. Null: not recorded. */
    lost: boolean | null;
}

export interface TournamentDraft {
    /** A new tournament gets this id; editing keeps the tournament's own. */
    id: string;
    name: string;
    date: string;
    params: TournamentParams;
    roundsByDivision?: Partial<Record<Division, number>>;
    entries: TournamentEntryDraft[];
    /** When it was first saved (keeps its place among same-day tournaments, e.g. after an undo). */
    created_at?: string | null;
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
        rated: existing?.rated !== false,
        created_at: existing?.created_at ?? draft.created_at ?? null,
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
                lost: e.lost,
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
    /** Everyone's current Elo if this were saved. */
    elo: Record<string, number>;
}

/** A saved tournament as a draft, e.g. to edit it or put it back after an undo. */
export function draftFromTournament(t: Tournament): TournamentDraft {
    const rounds = t.tournament_participants
        .map((p) => p.rounds)
        .filter((r): r is number => r != null && r > 0);
    const roundsByDivision: Partial<Record<Division, number>> = {};
    for (const p of t.tournament_participants) {
        if (p.rounds != null && roundsByDivision[p.division] == null) roundsByDivision[p.division] = p.rounds;
    }
    return {
        id: t.id,
        name: t.name ?? '',
        date: t.date,
        params: {
            n: rounds.length ? Math.max(...rounds) : 6,
            b: t.bonus ?? 0,
            k: t.affect ?? getEloConfig().k,
            maxGain: t.max_gain ?? null,
            maxRounds: t.max_rounds ?? null,
        },
        roundsByDivision,
        created_at: t.created_at ?? null,
        entries: t.tournament_participants.map((p) => ({
            key: p.id ?? crypto.randomUUID(),
            members: [p.debater_id, p.partner_id ?? null],
            division: p.division,
            prelimWins: p.raw_wins,
            elimWins: 0,
            lost: p.lost ?? null,
        })),
    };
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
    const elo: Record<string, number> = {};
    for (const [id, p] of Object.entries(derived.people)) elo[id] = p.elo;
    return { eTourney: derived.tournaments[input.id]?.e_tourney ?? 0, entries, elo };
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
        before ? 'Failed to save the tournament.' : 'Failed to record tournament results.',
        { action: `${before ? 'Edited' : 'Recorded'} ${row.name ?? 'a tournament'} (${row.date})` }
    );
    const out: Record<string, DerivedEntry> = {};
    for (const e of entries) if (derived.entries[e.id]) out[e.id] = derived.entries[e.id];
    const elo: Record<string, number> = {};
    for (const [id, p] of Object.entries(derived.people)) elo[id] = p.elo;
    return { eTourney: derived.tournaments[row.id]?.e_tourney ?? 0, entries: out, elo };
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
        'Failed to delete the tournament.',
        { action: `Deleted ${tournament.name ?? 'a tournament'} (${tournament.date})` }
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

// ------------------------------------------------------------ admin tools

/** One entry in the change log. */
export interface LoggedChange {
    id: string;
    created_at: string;
    actor: string | null;
    action: string;
    before: Changes;
    after: Changes;
    undoable: boolean;
    undoes: string | null;
    undone_at: string | null;
    undone_by: string | null;
}

/**
 * New scoring settings. Records that followed the old settings are rewritten
 * (see scoringRewrite), everyone is recalculated under the new ones, and a
 * backup of everything is taken first. Needs the admin password.
 */
export async function saveScoring(data: AppSnapshot, config: EloConfig, password: string) {
    const invalid = validateConfig(config);
    if (invalid) throw new MutationError(invalid);
    const rewrite = scoringRewrite(data.inputs, data.config, config);
    await commit(
        data,
        rewrite.inputs,
        { tournaments_upsert: rewrite.tournaments, people_upsert: rewrite.people },
        'Failed to save the scoring settings.',
        {
            action: 'Changed the scoring settings',
            undoable: false,
            snapshot: 'Before changing the scoring settings',
            password,
            settings: { key: 'elo', value: config },
            config,
        }
    );
}

/** End of the year: graduate a class and move people up a division. Needs the admin password. */
export async function startNewSeason(
    data: AppSnapshot,
    classYear: number,
    picks: { graduate: string[]; moveUp: string[] },
    password: string
) {
    const state = stateOf(data);
    const changes = newSeasonChanges(state, classYear, picks);
    if (!changes.people_upsert?.length) throw new MutationError('Pick at least one person to graduate or move up.');
    const g = picks.graduate.length;
    const m = picks.moveUp.length;
    await commit(data, applyChanges(state, changes).inputs, changes, 'Failed to start the new season.', {
        action: `New season: graduated ${g} ${g === 1 ? 'person' : 'people'}, moved ${m} up a division`,
        snapshot: 'Before the new season',
        password,
        requirePassword: true,
    });
}

/** Fold someone entered twice into the person to keep. A backup is taken first. */
export async function mergePeople(data: AppSnapshot, keepId: string, dropId: string) {
    const state = stateOf(data);
    const changes = mergeChanges(state, keepId, dropId);
    if (isEmptyChanges(changes)) throw new MutationError('Pick two different people.');
    const [keep, drop] = [namesOf(data, [keepId]), namesOf(data, [dropId])];
    await commit(data, applyChanges(state, changes).inputs, changes, 'Failed to merge them.', {
        action: `Merged ${drop} into ${keep}`,
        snapshot: `Before merging ${drop} into ${keep}`,
    });
}

export interface TournamentFix {
    id: string;
    name: string;
    bonus: number | null;
    rated: boolean;
}

/** Fix tournaments' names, types and whether they count, all in one save. */
export async function fixTournaments(data: AppSnapshot, fixes: TournamentFix[]) {
    const rows = [];
    const annotations_delete: DateName[] = [];
    const annotations_insert: DateName[] = [];
    for (const f of fixes) {
        const t = data.inputs.tournaments.find((x) => x.id === f.id);
        if (!t) continue;
        const { entries: _e, ...row } = t;
        const name = f.name.trim() || null;
        if (name === t.name && f.bonus === t.bonus && f.rated === (t.rated !== false)) continue;
        if (f.bonus != null && !Number.isFinite(f.bonus)) throw new MutationError('Each bonus needs to be a number.');
        rows.push({ ...row, name, bonus: f.bonus, rated: f.rated });
        if (name !== t.name) {
            if (t.name) annotations_delete.push({ date: t.date, name: t.name });
            if (name) annotations_insert.push({ date: t.date, name });
        }
    }
    if (!rows.length) return 0;
    const state = stateOf(data);
    const changes: Changes = { tournaments_upsert: rows, annotations_delete, annotations_insert };
    await commit(data, applyChanges(state, changes).inputs, changes, 'Failed to save the tournaments.', {
        action: rows.length === 1 ? `Fixed ${rows[0].name ?? 'a tournament'} (${rows[0].date})` : `Fixed ${rows.length} tournaments`,
    });
    return rows.length;
}

/**
 * Take a logged change back. Refused when a later save changed the same
 * results (undo that one first), or when it would remove someone who has
 * results now.
 */
export async function undoChange(data: AppSnapshot, entry: LoggedChange) {
    if (!entry.undoable) throw new MutationError('This change can’t be undone here. A backup from before it can be restored.');
    if (entry.undone_at) throw new MutationError('That change was already undone.');
    const state = stateOf(data);
    if (!stillAsSaved(state, entry.after)) {
        throw new MutationError('Something saved after this changed the same results. Undo that first.');
    }
    const removing = new Set(entry.before.people_delete ?? []);
    if (removing.size) {
        const busy = [
            ...state.inputs.tournaments.flatMap((t) => t.entries.flatMap((e) => [e.debater_id, e.partner_id])),
            ...state.inputs.practice.flatMap((r) => [r.winner_id, r.winner_partner_id, r.loser_id, r.loser_partner_id]),
            ...state.inputs.adjustments.map((a) => a.debater_id),
            ...state.teams.flatMap((t) => [t.member1_id, t.member2_id]),
        ].filter((id): id is string => !!id && removing.has(id));
        if (busy.length) {
            throw new MutationError(
                `${namesOf(data, [busy[0]])} has results or a team now, so undoing this would remove them. Remove them from Players instead.`
            );
        }
    }
    await commit(data, applyChanges(state, entry.before).inputs, entry.before, 'Failed to undo.', {
        action: `Undid: ${entry.action}`,
        undoable: false,
        undoes: entry.id,
    });
}

/**
 * Put anyone whose starting Elo is a standard number but not the one the
 * rule gives them (see startEloFor) on the right one. A backup is taken first.
 */
export async function applyStartEloRule(data: AppSnapshot) {
    const fixes = startEloFixes(data.inputs, data.config);
    if (!fixes.length) return 0;
    const state = stateOf(data);
    const changes: Changes = { people_upsert: fixes };
    const names = fixes.map((p) => p.name).join(', ');
    await commit(data, applyChanges(state, changes).inputs, changes, 'Failed to fix starting Elo.', {
        action: `Starting Elo by when they joined: ${names}`,
        snapshot: 'Before fixing starting Elo',
    });
    return fixes.length;
}
