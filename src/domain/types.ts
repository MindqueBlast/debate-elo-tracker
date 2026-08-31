export type DebaterStatus = 'active' | 'graduated';

export type Division = 'Novice' | 'JV' | 'Varsity';

export interface HistoryPoint {
    date: string;
    elo: number;
    event?: string;
}

export interface Debater {
    id: string;
    name: string;
    elo: number;
    status: DebaterStatus;
    graduation_date: string | null;
    history: HistoryPoint[];
}

export interface PracticeRound {
    id: string;
    date: string;
    winner_id: string;
    loser_id: string;
    winner_change: number;
    loser_change: number;
}

export interface TournamentParticipant {
    tournament_id: string;
    debater_id: string;
    raw_wins: number;
    adjusted_wins: number;
    elo_change: number;
    division: Division;
    debaters?: { name: string } | null;
}

export interface Tournament {
    id: string;
    date: string;
    name: string | null;
    e_tourney: number;
    tournament_participants: TournamentParticipant[];
}

export interface Annotation {
    id: string;
    date: string;
    name: string;
}

export interface TournamentParticipantInput {
    id: string;
    name: string;
    elo: number;
    division: Division;
    W_raw: number;
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
