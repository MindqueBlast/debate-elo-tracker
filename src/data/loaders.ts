import { supabase } from './supabase';
import {
    competedIn,
    computeAll,
    DEFAULT_CONFIG,
    setEloConfig,
    type EloConfig,
    getLocalDateString,
    latestSeason,
    sanitizeDebaters,
} from '../domain';
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
import { loadSettings } from './settings';

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
    /** The scoring settings everything here was calculated with. */
    config: EloConfig;
    /** Whether "Browse as guest" is offered. */
    guestAccess: boolean;
    /** The latest season with results ("2025-26"). */
    season: string;
    /** Everyone who competed in that season: who counts as active. */
    activeIds: ReadonlySet<string>;
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
    config: DEFAULT_CONFIG,
    guestAccess: true,
    season: '',
    activeIds: new Set(),
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
        settings,
    ] = await Promise.all([
        supabase.from('debaters').select('*').order('created_at'),
        supabase.from('teams').select('*').order('created_at'),
        supabase.from('annotations').select('*'),
        supabase.from('practice_rounds').select('*'),
        supabase.from('tournaments').select('*, tournament_participants(*)'),
        supabase.from('elo_adjustments').select('*'),
        supabase.from('app_state').select('revision').eq('id', 1).maybeSingle(),
        // the scoring numbers feed the math, so they have to load too
        loadSettings(),
    ]);
    setEloConfig(settings.elo);

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
    const today = getLocalDateString();
    const fresh = withResults(rows, computeAll(inputs, today));
    const season = latestSeason(fresh.tournaments, today);

    return {
        ...fresh,
        teams: asTeams(teamsRes.data ?? []),
        annotations: asAnnotations(annotationsRes.data),
        inputs,
        stored: storedResults(rows),
        revision: Number(stateRes.data?.revision ?? 0),
        config: settings.elo,
        guestAccess: settings.guestAccess,
        season,
        activeIds: competedIn(fresh.tournaments, season),
    };
}
