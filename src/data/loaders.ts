import { supabase } from './supabase';
import { computeAll, getLocalDateString, sanitizeDebaters } from '../domain';
import type {
    Annotation,
    Debater,
    Derived,
    EloAdjustment,
    Inputs,
    PracticeRound,
    Team,
    Tournament,
} from '../domain';
import {
    asAdjustments,
    asAnnotations,
    asPracticeRounds,
    asTeams,
    asTournaments,
} from './parse';
import { storedResults, toInputs, withResults } from './model';

export interface AppSnapshot {
    /** Elo and history here are always freshly calculated from every result. */
    debaters: Debater[];
    teams: Team[];
    practiceRounds: PracticeRound[];
    tournaments: Tournament[];
    annotations: Annotation[];
    adjustments: EloAdjustment[];
    /** The facts everything is calculated from. */
    inputs: Inputs;
    /** The numbers currently saved in the database, so a save writes back only what changed. */
    stored: Derived;
    /** Goes up with every save; a save based on older data is refused. */
    revision: number;
}

export const EMPTY_SNAPSHOT: AppSnapshot = {
    debaters: [],
    teams: [],
    practiceRounds: [],
    tournaments: [],
    annotations: [],
    adjustments: [],
    inputs: { people: [], tournaments: [], practice: [], adjustments: [] },
    stored: { people: {}, entries: {}, tournaments: {}, practice: {} },
    revision: 0,
};

export async function loadSnapshot(): Promise<AppSnapshot> {
    const [
        debatersRes,
        teamsRes,
        annotationsRes,
        roundsRes,
        tournamentsRes,
        adjustmentsRes,
        stateRes,
    ] = await Promise.all([
        supabase.from('debaters').select('*').order('created_at'),
        supabase.from('teams').select('*').order('created_at'),
        supabase.from('annotations').select('*'),
        supabase.from('practice_rounds').select('*'),
        supabase.from('tournaments').select('*, tournament_participants(*)'),
        supabase.from('elo_adjustments').select('*'),
        supabase.from('app_state').select('revision').eq('id', 1).maybeSingle(),
    ]);

    // Everything that feeds the Elo math has to load, or the numbers would be wrong
    for (const res of [debatersRes, roundsRes, tournamentsRes, adjustmentsRes, stateRes]) {
        if (res.error) throw res.error;
    }
    if (annotationsRes.error) throw annotationsRes.error;

    const rows = {
        debaters: sanitizeDebaters(debatersRes.data),
        tournaments: asTournaments(tournamentsRes.data ?? []),
        practiceRounds: asPracticeRounds(roundsRes.data ?? []),
        adjustments: asAdjustments(adjustmentsRes.data ?? []),
    };
    const inputs = toInputs(rows);
    const fresh = withResults(rows, computeAll(inputs, getLocalDateString()));

    return {
        ...fresh,
        teams: asTeams(teamsRes.data ?? []),
        annotations: asAnnotations(annotationsRes.data),
        inputs,
        stored: storedResults(rows),
        revision: Number(stateRes.data?.revision ?? 0),
    };
}
