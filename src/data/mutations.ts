import { supabase } from './supabase';
import {
    appendHistory,
    calculatePracticeElo,
    calculateTournamentElo,
    getLocalDateString,
    hasLaterHistory,
    removeLastMatchingHistoryPoint,
    validatePlayerName,
    validatePracticeMatch,
    validateTournamentParams,
    type Debater,
    type Division,
    type TournamentParams,
    type TournamentParticipantInput,
} from '../domain';

export class MutationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MutationError';
    }
}

export async function addDebater(
    name: string,
    startingElo: number,
    existing: Debater[]
) {
    const nameError = validatePlayerName(name, existing);
    if (nameError) throw new MutationError(nameError);
    const today = getLocalDateString();
    const { error } = await supabase.from('debaters').insert({
        name: name.trim(),
        elo: startingElo,
        status: 'active',
        graduation_date: null,
        history: [{ date: today, elo: startingElo }],
    });
    if (error) throw new MutationError('Failed to add debater.');
}

export async function removeDebater(id: string) {
    const { error } = await supabase.from('debaters').delete().eq('id', id);
    if (error) throw new MutationError('Failed to remove debater.');
}

export async function toggleGraduate(debater: Debater) {
    const newStatus = debater.status === 'active' ? 'graduated' : 'active';
    const newGraduationDate =
        newStatus === 'graduated' ? new Date().getFullYear().toString() : null;
    const { error } = await supabase
        .from('debaters')
        .update({ status: newStatus, graduation_date: newGraduationDate })
        .eq('id', debater.id);
    if (error) throw new MutationError('Failed to update status.');
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

export async function recordPracticeRound(input: {
    winner: Debater;
    loser: Debater;
    date?: string;
}) {
    const invalid = validatePracticeMatch(input.winner.id, input.loser.id);
    if (invalid) throw new MutationError(invalid);

    const date = input.date || getLocalDateString();
    const result = calculatePracticeElo(input.winner.elo, input.loser.elo);
    const winnerHistory = appendHistory(input.winner.history, {
        date,
        elo: result.newWinnerElo,
    });
    const loserHistory = appendHistory(input.loser.history, {
        date,
        elo: result.newLoserElo,
    });

    const { error: winnerError } = await supabase
        .from('debaters')
        .update({ elo: result.newWinnerElo, history: winnerHistory })
        .eq('id', input.winner.id);
    if (winnerError) throw new MutationError('Failed to save match results.');

    const { error: loserError } = await supabase
        .from('debaters')
        .update({ elo: result.newLoserElo, history: loserHistory })
        .eq('id', input.loser.id);
    if (loserError) {
        await supabase
            .from('debaters')
            .update({ elo: input.winner.elo, history: input.winner.history })
            .eq('id', input.winner.id);
        throw new MutationError('Failed to save match results.');
    }

    const { error: insertError } = await supabase.from('practice_rounds').insert([
        {
            date,
            winner_id: input.winner.id,
            loser_id: input.loser.id,
            winner_change: result.winnerChange,
            loser_change: result.loserChange,
        },
    ]);
    if (insertError) {
        await Promise.all([
            supabase
                .from('debaters')
                .update({ elo: input.winner.elo, history: input.winner.history })
                .eq('id', input.winner.id),
            supabase
                .from('debaters')
                .update({ elo: input.loser.elo, history: input.loser.history })
                .eq('id', input.loser.id),
        ]);
        throw new MutationError('Failed to save match results.');
    }

    return result;
}

export async function deletePracticeRound(input: {
    roundId: string;
    date: string;
    winner: Debater;
    loser: Debater;
    winnerChange: number;
    loserChange: number;
}): Promise<{ approximate: boolean }> {
    const winnerHistory = removeLastMatchingHistoryPoint(
        input.winner.history,
        input.date
    );
    const loserHistory = removeLastMatchingHistoryPoint(
        input.loser.history,
        input.date
    );
    const approximate =
        hasLaterHistory(input.winner.history, input.date) ||
        hasLaterHistory(input.loser.history, input.date);

    const { error } = await supabase
        .from('debaters')
        .update({
            elo: input.winner.elo - input.winnerChange,
            history: winnerHistory,
        })
        .eq('id', input.winner.id);
    if (error) throw new MutationError('Failed to delete and undo changes.');

    const { error: loserError } = await supabase
        .from('debaters')
        .update({
            elo: input.loser.elo - input.loserChange,
            history: loserHistory,
        })
        .eq('id', input.loser.id);
    if (loserError) throw new MutationError('Failed to delete and undo changes.');

    const { error: deleteError } = await supabase
        .from('practice_rounds')
        .delete()
        .eq('id', input.roundId);
    if (deleteError) throw new MutationError('Failed to delete and undo changes.');

    return { approximate };
}

export async function recordTournament(input: {
    name: string;
    date: string;
    params: TournamentParams;
    participants: TournamentParticipantInput[];
    activeDebaters: Debater[];
}) {
    const invalid = validateTournamentParams(
        input.params,
        input.participants.length,
        input.activeDebaters.length
    );
    if (invalid) throw new MutationError(invalid);
    if (input.participants.some((p) => p.W_raw === undefined || p.W_raw < 0)) {
        throw new MutationError('Please enter valid raw wins for every participant.');
    }

    const liveParticipants = input.participants.map((p) => {
        const live = input.activeDebaters.find((d) => d.id === p.id);
        return { ...p, elo: live?.elo ?? p.elo };
    });

    const { eTourney, results } = calculateTournamentElo(
        liveParticipants,
        input.params
    );
    const date = input.date || getLocalDateString();

    const { data: inserted, error: insertError } = await supabase
        .from('tournaments')
        .insert([{ date, name: input.name, e_tourney: eTourney }])
        .select()
        .single();
    if (insertError || !inserted) {
        throw new MutationError('Failed to record tournament results.');
    }

    if (input.name && date) {
        await supabase
            .from('annotations')
            .insert({ date, name: input.name });
    }

    const participantIds = new Set(results.map((r) => r.id));
    const byId = new Map(input.activeDebaters.map((d) => [d.id, d]));

    for (const res of results) {
        const debater = byId.get(res.id);
        if (!debater) continue;
        const newHistory = appendHistory(debater.history, {
            date,
            elo: res.newElo,
            event: 'Tournament',
        });
        const { error } = await supabase
            .from('debaters')
            .update({ elo: res.newElo, history: newHistory })
            .eq('id', res.id);
        if (error) throw new MutationError('Failed to record tournament results.');
    }

    for (const debater of input.activeDebaters) {
        if (participantIds.has(debater.id)) continue;
        const last = debater.history[debater.history.length - 1];
        if (last && last.date === date) continue;
        const newHistory = appendHistory(debater.history, {
            date,
            elo: debater.elo,
            event: 'Tournament',
        });
        const { error } = await supabase
            .from('debaters')
            .update({ history: newHistory })
            .eq('id', debater.id);
        if (error) throw new MutationError('Failed to record tournament results.');
    }

    const { error: partsError } = await supabase
        .from('tournament_participants')
        .insert(
            results.map((res) => ({
                tournament_id: inserted.id,
                debater_id: res.id,
                raw_wins: res.W_raw,
                adjusted_wins: res.W_adjusted,
                elo_change: res.change,
                division: res.division,
            }))
        );
    if (partsError) throw new MutationError('Failed to record tournament results.');

    return { eTourney, results };
}

export async function deleteTournament(input: {
    tournamentId: string;
    date: string;
    participantChanges: { debaterId: string; eloChange: number }[];
    debaters: Debater[];
}): Promise<{ approximate: boolean }> {
    let approximate = false;
    for (const change of input.participantChanges) {
        const debater = input.debaters.find((d) => d.id === change.debaterId);
        if (!debater) continue;
        if (hasLaterHistory(debater.history, input.date)) approximate = true;
        const newHistory = removeLastMatchingHistoryPoint(
            debater.history,
            input.date,
            'Tournament'
        );
        const { error } = await supabase
            .from('debaters')
            .update({
                elo: debater.elo - change.eloChange,
                history: newHistory,
            })
            .eq('id', debater.id);
        if (error) throw new MutationError('Failed to revert Elo for a debater.');
    }

    const participantIds = new Set(input.participantChanges.map((p) => p.debaterId));
    for (const debater of input.debaters) {
        if (participantIds.has(debater.id)) continue;
        const hasPoint = debater.history.some(
            (h) => h.date === input.date && h.event === 'Tournament'
        );
        if (!hasPoint) continue;
        const newHistory = removeLastMatchingHistoryPoint(
            debater.history,
            input.date,
            'Tournament'
        );
        await supabase
            .from('debaters')
            .update({ history: newHistory })
            .eq('id', debater.id);
    }

    const { error: partsError } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', input.tournamentId);
    if (partsError) throw new MutationError('Failed to delete tournament participants.');

    const { error: tourneyError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', input.tournamentId);
    if (tourneyError) throw new MutationError('Failed to delete tournament.');

    return { approximate };
}

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

export type DraftParticipant = {
    id: string;
    name: string;
    division: Division;
    prelim_wins: number;
    elim_wins: number;
};
