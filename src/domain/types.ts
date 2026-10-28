export type DebaterStatus = 'active' | 'graduated';

export type Division = 'Novice' | 'JV' | 'Varsity';

export const DIVISIONS: Division[] = ['Varsity', 'JV', 'Novice'];

/** Starting Elo for someone new, by the division they start in. */
export const BASE_ELO: Record<Division, number> = {
    Novice: 400,
    JV: 650,
    Varsity: 900,
};

export interface HistoryPoint {
    date: string;
    elo: number;
    event?: string;
}

/** One person on the roster. Everyone carries their own Elo. */
export interface Debater {
    id: string;
    name: string;
    elo: number;
    status: DebaterStatus;
    graduation_date: string | null;
    history: HistoryPoint[];
    division?: Division | null;
}

/**
 * A saved partnership. Teams are for viewing and quick entry; the Elo lives on
 * the two people, and a team's Elo is always the average of its members.
 */
export interface Team {
    id: string;
    name: string | null;
    member1_id: string;
    member2_id: string;
    division: Division | null;
    season: string | null;
    active: boolean;
}

/** The people on one side of a round or one tournament entry. */
export type Pairing = [string, string | null];

export interface PracticeRound {
    id: string;
    date: string;
    winner_id: string;
    loser_id: string;
    winner_partner_id?: string | null;
    loser_partner_id?: string | null;
    winner_change: number;
    loser_change: number;
    /** The partners' own changes (null on rounds recorded before individual math). */
    winner_partner_change?: number | null;
    loser_partner_change?: number | null;
}

export interface TournamentParticipant {
    id?: string;
    tournament_id: string;
    debater_id: string;
    partner_id?: string | null;
    team_id?: string | null;
    raw_wins: number;
    adjusted_wins: number;
    /** Change for debater_id. */
    elo_change: number;
    /** Change for partner_id (null on older rows: same as elo_change). */
    partner_elo_change?: number | null;
    division: Division;
    team_elo?: number | null;
    rounds?: number | null;
}

export interface Tournament {
    id: string;
    date: string;
    name: string | null;
    e_tourney: number;
    bonus?: number | null;
    affect?: number | null;
    max_gain?: number | null;
    max_rounds?: number | null;
    tournament_participants: TournamentParticipant[];
}

export interface Annotation {
    id: string;
    date: string;
    name: string;
}

export interface MemberElo {
    id: string;
    elo: number;
}

export interface MemberChange {
    id: string;
    oldElo: number;
    newElo: number;
    change: number;
}

export interface TournamentParticipantInput {
    id: string;
    name: string;
    /** Entry Elo: the average of the two partners (for display). */
    elo: number;
    /** The people in the entry, each scored on their own Elo. Defaults to one person at `elo`. */
    members?: MemberElo[];
    division: Division;
    W_raw: number;
    /** Prelim rounds for this entry's division, when it differs from params.n. */
    n?: number;
}

export interface TournamentParams {
    n: number;
    b: number;
    k: number;
    maxGain: number;
    maxRounds: number | null;
}

export interface TournamentResult {
    id: string;
    name: string;
    oldElo: number;
    newElo: number;
    change: number;
    W_adjusted: number;
    p_value: number;
    W_raw: number;
    division: Division;
    n: number;
    /** Each person's own change. The entry-level change above is their average. */
    members: (MemberChange & { p_value: number })[];
}

export interface PairPracticeResult {
    /** Pair-vs-pair win probability, from the two pairs' average Elos. */
    expected: number;
    winnerElo: number;
    loserElo: number;
    winners: MemberChange[];
    losers: MemberChange[];
}

export interface PracticeEloResult {
    expected: number;
    winnerChange: number;
    loserChange: number;
    newWinnerElo: number;
    newLoserElo: number;
}

export interface RankedDebater extends Debater {
    rank: number;
    wins: number;
    losses: number;
    played: number;
    winRate: number | null;
}

export interface RankedTeam {
    team: Team;
    name: string;
    members: Debater[];
    elo: number;
    rank: number;
}

export interface ChartPoint {
    x: string;
    y: number;
    event?: string;
}

export interface ChartSeries {
    id: string;
    label: string;
    data: ChartPoint[];
}

export interface EloSeriesResult {
    series: ChartSeries[];
    yMin: number | null;
    yMax: number | null;
    isEmpty: boolean;
}
