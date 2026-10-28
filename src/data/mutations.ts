import { supabase } from './supabase';
import {
    appendHistory,
    calculatePracticeElo,
    calculateTournamentElo,
    findTeam,
    getLocalDateString,
    hasLaterHistory,
    lookup,
    pairingElo,
    pairingLabel,
    removeLastMatchingHistoryPoint,
    seasonOf,
    validatePlayerName,
    validateTournamentParams,
    type Debater,
    type Division,
    type HistoryPoint,
    type Pairing,
    type PracticeRound,
    type Team,
    type Tournament,
    type TournamentParams,
} from '../domain';

export class MutationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MutationError';
    }
}

// ---------------------------------------------------------------- people

export async function addDebater(input: {
    name: string;
    division: Division;
    startingElo: number;
    existing: Debater[];
}) {
    const nameError = validatePlayerName(input.name, input.existing);
    if (nameError) throw new MutationError(nameError);
    if (!Number.isFinite(input.startingElo)) {
        throw new MutationError('Starting Elo must be a number.');
    }
    const today = getLocalDateString();
    const { error } = await supabase.from('debaters').insert({
        name: input.name.trim(),
        elo: input.startingElo,
        status: 'active',
        graduation_date: null,
        division: input.division,
        history: [{ date: today, elo: input.startingElo }],
    });
    if (error) throw new MutationError('Failed to add person.');
}

export async function updateDebater(
    debater: Debater,
    patch: { name?: string; division?: Division | null },
    existing: Debater[]
) {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined && patch.name.trim() !== debater.name) {
        const nameError = validatePlayerName(patch.name, existing, debater.id);
        if (nameError) throw new MutationError(nameError);
        update.name = patch.name.trim();
    }
    if (patch.division !== undefined) update.division = patch.division;
    if (Object.keys(update).length === 0) return;
    const { error } = await supabase
        .from('debaters')
        .update(update)
        .eq('id', debater.id);
    if (error) throw new MutationError('Failed to save changes.');
}

export async function removeDebater(id: string) {
    const { error } = await supabase.from('debaters').delete().eq('id', id);
    if (error) {
        throw new MutationError(
            'This person has recorded results, so they can’t be removed. Mark them graduated instead.'
        );
    }
}

export async function toggleGraduate(debater: Debater) {
    const newStatus = debater.status === 'active' ? 'graduated' : 'active';
    // graduation_date is a date column, so store today's date (not just the year)
    const newGraduationDate = newStatus === 'graduated' ? getLocalDateString() : null;
    const { error } = await supabase
        .from('debaters')
        .update({ status: newStatus, graduation_date: newGraduationDate })
        .eq('id', debater.id);
    if (error) throw new MutationError('Failed to update status.');
    if (newStatus === 'graduated') {
        // A graduated person's teams come off the active list
        await supabase
            .from('teams')
            .update({ active: false })
            .or(`member1_id.eq.${debater.id},member2_id.eq.${debater.id}`);
    }
}

export async function setDebaterElo(debater: Debater, newElo: number) {
    if (!Number.isFinite(newElo)) {
        throw new MutationError('Invalid Elo value.');
    }
    const newHistory = appendHistory(debater.history, {
        date: getLocalDateString(),
        elo: newElo,
        event: 'Manual Adjustment',
    });
    const { error } = await supabase
        .from('debaters')
        .update({ elo: newElo, history: newHistory })
        .eq('id', debater.id);
    if (error) throw new MutationError('Failed to set Elo.');
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

// -------------------------------------------------------- shared helpers

type EloUpdate = { debater: Debater; elo: number; history: HistoryPoint[] };

/** Save new Elo + history for several people; undo the ones that saved if any fail. */
async function saveUpdates(updates: EloUpdate[], message: string) {
    const done: EloUpdate[] = [];
    for (const u of updates) {
        const { error } = await supabase
            .from('debaters')
            .update({ elo: u.elo, history: u.history })
            .eq('id', u.debater.id);
        if (error) {
            await restore(done);
            throw new MutationError(message);
        }
        done.push(u);
    }
    return done;
}

async function restore(updates: EloUpdate[]) {
    await Promise.all(
        updates.map((u) =>
            supabase
                .from('debaters')
                .update({ elo: u.debater.elo, history: u.debater.history })
                .eq('id', u.debater.id)
        )
    );
}

function membersOf(ids: (string | null | undefined)[], byId: Map<string, Debater>) {
    const out: Debater[] = [];
    for (const id of ids) {
        if (!id) continue;
        const d = byId.get(id);
        if (!d) throw new MutationError('Someone in this result is no longer on the roster.');
        out.push(d);
    }
    return out;
}

function checkNoOverlap(sides: Pairing[]) {
    const seen = new Set<string>();
    for (const side of sides) {
        checkPair(side);
        for (const id of side) {
            if (!id) continue;
            if (seen.has(id)) {
                throw new MutationError('The same person can’t be on two sides.');
            }
            seen.add(id);
        }
    }
}

// --------------------------------------------------------- practice rounds

export async function recordPracticeRound(input: {
    winner: Pairing;
    loser: Pairing;
    date?: string;
    debaters: Debater[];
}) {
    checkNoOverlap([input.winner, input.loser]);
    const byId = lookup(input.debaters);
    const winners = membersOf(input.winner, byId);
    const losers = membersOf(input.loser, byId);
    const date = input.date || getLocalDateString();
    const winnerElo = pairingElo(winners.map((d) => d.elo));
    const loserElo = pairingElo(losers.map((d) => d.elo));
    const result = calculatePracticeElo(winnerElo, loserElo);

    const updates: EloUpdate[] = [
        ...winners.map((d) => ({
            debater: d,
            elo: d.elo + result.winnerChange,
            history: appendHistory(d.history, { date, elo: d.elo + result.winnerChange }),
        })),
        ...losers.map((d) => ({
            debater: d,
            elo: d.elo + result.loserChange,
            history: appendHistory(d.history, { date, elo: d.elo + result.loserChange }),
        })),
    ];
    const saved = await saveUpdates(updates, 'Failed to save the round.');

    const { error } = await supabase.from('practice_rounds').insert({
        date,
        winner_id: input.winner[0],
        winner_partner_id: input.winner[1],
        loser_id: input.loser[0],
        loser_partner_id: input.loser[1],
        winner_change: result.winnerChange,
        loser_change: result.loserChange,
    });
    if (error) {
        await restore(saved);
        throw new MutationError('Failed to save the round.');
    }
    return { ...result, winnerElo, loserElo };
}

export async function deletePracticeRound(input: {
    round: PracticeRound;
    debaters: Debater[];
}): Promise<{ approximate: boolean }> {
    const { round } = input;
    const byId = lookup(input.debaters);
    const sides: [(string | null | undefined)[], number][] = [
        [[round.winner_id, round.winner_partner_id], round.winner_change],
        [[round.loser_id, round.loser_partner_id], round.loser_change],
    ];
    let approximate = false;
    const updates: EloUpdate[] = [];
    for (const [ids, change] of sides) {
        for (const id of ids) {
            if (!id) continue;
            const d = byId.get(id);
            if (!d) continue;
            if (hasLaterHistory(d.history, round.date)) approximate = true;
            updates.push({
                debater: d,
                elo: d.elo - change,
                history: removeLastMatchingHistoryPoint(d.history, round.date),
            });
        }
    }
    const saved = await saveUpdates(updates, 'Failed to undo the round.');
    const { error } = await supabase.from('practice_rounds').delete().eq('id', round.id);
    if (error) {
        await restore(saved);
        throw new MutationError('Failed to undo the round.');
    }
    return { approximate };
}

// ------------------------------------------------------------- tournaments

export interface TournamentEntryDraft {
    key: string;
    members: Pairing;
    division: Division;
    prelimWins: number;
    elimWins: number;
}

/** Break wins count double. */
export const rawWinsOf = (prelim: number, elim: number) => prelim + 2 * elim;

export function previewTournament(input: {
    params: TournamentParams;
    roundsByDivision?: Partial<Record<Division, number>>;
    entries: TournamentEntryDraft[];
    debaters: Debater[];
}) {
    const byId = lookup(input.debaters);
    return calculateTournamentElo(
        input.entries.map((e) => ({
            id: e.key,
            name: pairingLabel(e.members, byId),
            elo: pairingElo(membersOf(e.members, byId).map((d) => d.elo)),
            division: e.division,
            W_raw: rawWinsOf(e.prelimWins, e.elimWins),
            n: input.roundsByDivision?.[e.division] ?? input.params.n,
        })),
        input.params
    );
}

export async function recordTournament(input: {
    name: string;
    date: string;
    params: TournamentParams;
    roundsByDivision?: Partial<Record<Division, number>>;
    entries: TournamentEntryDraft[];
    debaters: Debater[];
    teams: Team[];
}) {
    const active = input.debaters.filter((d) => d.status === 'active');
    const invalid = validateTournamentParams(
        input.params,
        input.entries.length,
        active.length
    );
    if (invalid) throw new MutationError(invalid);
    checkNoOverlap(input.entries.map((e) => e.members));
    for (const e of input.entries) {
        if (
            !Number.isFinite(e.prelimWins) ||
            !Number.isFinite(e.elimWins) ||
            e.prelimWins < 0 ||
            e.elimWins < 0
        ) {
            throw new MutationError('Please enter valid wins for every entry.');
        }
    }

    const byId = lookup(input.debaters);
    const { eTourney, results } = previewTournament(input);
    const date = input.date || getLocalDateString();

    const { data: inserted, error: insertError } = await supabase
        .from('tournaments')
        .insert({
            date,
            name: input.name,
            e_tourney: eTourney,
            bonus: input.params.b,
            affect: input.params.k,
            max_gain: input.params.maxGain,
            max_rounds: input.params.maxRounds,
        })
        .select()
        .single();
    if (insertError || !inserted) {
        throw new MutationError('Failed to record tournament results.');
    }

    const updates: EloUpdate[] = [];
    const playing = new Set<string>();
    results.forEach((res, i) => {
        for (const d of membersOf(input.entries[i].members, byId)) {
            playing.add(d.id);
            const elo = d.elo + res.change;
            updates.push({
                debater: d,
                elo,
                history: appendHistory(d.history, { date, elo, event: 'Tournament' }),
            });
        }
    });
    // Flat point for everyone active who sat this one out, so graphs line up
    for (const d of active) {
        if (playing.has(d.id)) continue;
        const last = d.history[d.history.length - 1];
        if (last && last.date === date) continue;
        updates.push({
            debater: d,
            elo: d.elo,
            history: appendHistory(d.history, { date, elo: d.elo, event: 'Tournament' }),
        });
    }

    let saved: EloUpdate[] = [];
    try {
        saved = await saveUpdates(updates, 'Failed to record tournament results.');
        const { error: partsError } = await supabase
            .from('tournament_participants')
            .insert(
                results.map((res, i) => {
                    const entry = input.entries[i];
                    return {
                        tournament_id: inserted.id,
                        debater_id: entry.members[0],
                        partner_id: entry.members[1],
                        team_id: findTeam(input.teams, entry.members)?.id ?? null,
                        raw_wins: res.W_raw,
                        adjusted_wins: res.W_adjusted,
                        elo_change: res.change,
                        division: res.division,
                        team_elo: res.oldElo,
                        rounds: res.n,
                    };
                })
            );
        if (partsError) throw new MutationError('Failed to record tournament results.');
    } catch (err) {
        await restore(saved);
        await supabase.from('tournaments').delete().eq('id', inserted.id);
        throw err instanceof MutationError
            ? err
            : new MutationError('Failed to record tournament results.');
    }

    if (input.name && date) {
        await supabase.from('annotations').insert({ date, name: input.name });
    }

    return { eTourney, results };
}

export async function deleteTournament(input: {
    tournament: Tournament;
    debaters: Debater[];
}): Promise<{ approximate: boolean }> {
    const { tournament } = input;
    const byId = lookup(input.debaters);
    let approximate = false;
    const updates: EloUpdate[] = [];
    const touched = new Set<string>();
    for (const p of tournament.tournament_participants) {
        for (const id of [p.debater_id, p.partner_id]) {
            if (!id || touched.has(id)) continue;
            const d = byId.get(id);
            if (!d) continue;
            touched.add(id);
            if (hasLaterHistory(d.history, tournament.date)) approximate = true;
            updates.push({
                debater: d,
                elo: d.elo - p.elo_change,
                history: removeLastMatchingHistoryPoint(
                    d.history,
                    tournament.date,
                    'Tournament'
                ),
            });
        }
    }
    for (const d of input.debaters) {
        if (touched.has(d.id)) continue;
        const hasPoint = d.history.some(
            (h) => h.date === tournament.date && h.event === 'Tournament'
        );
        if (!hasPoint) continue;
        updates.push({
            debater: d,
            elo: d.elo,
            history: removeLastMatchingHistoryPoint(
                d.history,
                tournament.date,
                'Tournament'
            ),
        });
    }

    const saved = await saveUpdates(updates, 'Failed to undo the tournament.');
    const { error: partsError } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournament.id);
    if (partsError) {
        await restore(saved);
        throw new MutationError('Failed to undo the tournament.');
    }
    const { error: tourneyError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id);
    if (tourneyError) throw new MutationError('Failed to delete the tournament.');
    if (tournament.name) {
        await supabase
            .from('annotations')
            .delete()
            .eq('date', tournament.date)
            .eq('name', tournament.name);
    }
    return { approximate };
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

export async function deleteHistoryPoint(debater: Debater, date: string) {
    const newHistory = removeLastMatchingHistoryPoint(debater.history, date);
    const { error } = await supabase
        .from('debaters')
        .update({ history: newHistory })
        .eq('id', debater.id);
    if (error) throw new MutationError('Failed to update debater history.');
}
