import type {
    PairPracticeResult,
    PracticeEloResult,
    TournamentParams,
    TournamentParticipantInput,
    TournamentResult,
} from './types';

export const PRACTICE_COMPETITIVE_K = 20;
export const PRACTICE_BONUS_K = 5;
export const TOURNAMENT_FIELD_ELO = 700;

export function expectedScore(winnerElo: number, loserElo: number): number {
    return 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
}

export function calculatePracticeElo(
    winnerElo: number,
    loserElo: number
): PracticeEloResult {
    const E = expectedScore(winnerElo, loserElo);
    const winnerChange =
        (PRACTICE_COMPETITIVE_K + PRACTICE_BONUS_K) * (1 - E);
    const loserChange =
        -PRACTICE_COMPETITIVE_K * (1 - E) + PRACTICE_BONUS_K * E;
    return {
        expected: E,
        winnerChange,
        loserChange,
        newWinnerElo: winnerElo + winnerChange,
        newLoserElo: loserElo + loserChange,
    };
}

/**
 * A practice round between two pairs. Each person's expected score uses their
 * own Elo against the other pair's average, so partners can move by different
 * amounts for the same round.
 */
export function calculatePracticeEloForPairs(
    winners: { id: string; elo: number }[],
    losers: { id: string; elo: number }[]
): PairPracticeResult {
    const avg = (xs: { elo: number }[]) => xs.reduce((s, x) => s + x.elo, 0) / xs.length;
    const winnerElo = avg(winners);
    const loserElo = avg(losers);
    return {
        expected: expectedScore(winnerElo, loserElo),
        winnerElo,
        loserElo,
        winners: winners.map((w) => {
            const E = expectedScore(w.elo, loserElo);
            const change = (PRACTICE_COMPETITIVE_K + PRACTICE_BONUS_K) * (1 - E);
            return { id: w.id, oldElo: w.elo, newElo: w.elo + change, change };
        }),
        losers: losers.map((l) => {
            const E = expectedScore(winnerElo, l.elo);
            const change = -PRACTICE_COMPETITIVE_K * (1 - E) + PRACTICE_BONUS_K * E;
            return { id: l.id, oldElo: l.elo, newElo: l.elo + change, change };
        }),
    };
}

export function validatePracticeMatch(
    winnerId: string,
    loserId: string
): string | null {
    if (!winnerId || !loserId) return 'Please select two different debaters.';
    if (winnerId === loserId) return 'Please select two different debaters.';
    return null;
}

export function adjustedWins(
    division: TournamentParticipantInput['division'],
    W_raw: number,
    n: number
): number {
    if (division === 'Novice') return W_raw;
    const winPercent = n > 0 ? (W_raw / n) * 100 : 0;
    if (division === 'JV') {
        return ((-200 / (winPercent + 6.7) + 30) / 100) * n + W_raw;
    }
    return ((-200 / (winPercent + 4) + 50) / 100) * n + W_raw;
}

/**
 * Tournament Elo for every entry.
 *
 * What a result is worth belongs to the entry: adjusted wins come from the
 * entry's record, division and rounds, and E_tourney comes from all entries.
 * Each person's change then uses their own Elo (see TournamentFormula above).
 *
 * Entries can carry their own round count (e.g. novices had 5 prelims and
 * varsity had 6). Adjusted wins use the entry's own rounds, and the three
 * phantom teams in E_tourney use the average rounds across entries, which is
 * how the spreadsheet blends divisions.
 */
/**
 * How each person's change is worked out (p = (their Elo / 700)^1.5):
 * - 'expected' (in use): k × (adjusted wins − p × E_tourney) + b. What's
 *   expected of you grows with your Elo, so a higher-rated partner gains less
 *   and loses more for the same result.
 * - 'current' (the earlier one): k × (adjusted wins ÷ p − E_tourney) + b.
 *   Only gains shrink with Elo; a winless result costs everyone the same.
 * - 'pair': like 'expected' but divided by the pair's average p, which keeps
 *   a pair's combined change close to the earlier formula.
 */
export type TournamentFormula = 'current' | 'expected' | 'pair';
let FORMULA: TournamentFormula = 'expected';
/** For comparing versions; the app always uses the default above. */
export function setTournamentFormula(f: TournamentFormula) {
    FORMULA = f;
}

export function calculateTournamentElo(
    participants: TournamentParticipantInput[],
    params: TournamentParams
): { eTourney: number; results: TournamentResult[] } {
    const { b, k, maxGain, maxRounds } = params;
    const t = participants.length;
    let s = 0;
    let roundsTotal = 0;
    const withAdjusted = participants.map((p) => {
        const n = p.n ?? params.n;
        const W_adjusted = adjustedWins(p.division, p.W_raw, n);
        s += W_adjusted;
        roundsTotal += n;
        return { ...p, n, W_adjusted };
    });
    const avgRounds = t > 0 ? roundsTotal / t : params.n;

    const eTourney = (s + (3 * avgRounds) / 2) / (t + 3);

    const results: TournamentResult[] = withAdjusted.map((p) => {
        const people =
            p.members && p.members.length > 0 ? p.members : [{ id: p.id, elo: p.elo }];
        const pOf = (elo: number) => Math.pow(elo / TOURNAMENT_FIELD_ELO, 1.5);
        const pAvg = people.reduce((sum, m) => sum + pOf(m.elo), 0) / people.length;
        const members = people.map((m) => {
            const p_value = pOf(m.elo);
            let C =
                FORMULA === 'expected'
                    ? k * (p.W_adjusted - p_value * eTourney) + b
                    : FORMULA === 'pair'
                      ? (k * (p.W_adjusted - p_value * eTourney)) / pAvg + b
                      : k * (p.W_adjusted / p_value - eTourney) + b;
            if (maxRounds !== null && p.W_raw === maxRounds && C < 0) {
                C = 0;
            }
            if (C > maxGain) {
                C = maxGain;
            }
            return { id: m.id, oldElo: m.elo, newElo: m.elo + C, change: C, p_value };
        });
        const change = members.reduce((sum, m) => sum + m.change, 0) / members.length;
        return {
            id: p.id,
            name: p.name,
            oldElo: p.elo,
            newElo: p.elo + change,
            change,
            W_adjusted: p.W_adjusted,
            p_value: Math.pow(p.elo / TOURNAMENT_FIELD_ELO, 1.5),
            W_raw: p.W_raw,
            division: p.division,
            n: p.n,
            members,
        };
    });

    return { eTourney, results };
}

/** A pairing's Elo: the average of the people in it. */
export function pairingElo(elos: number[]): number {
    if (elos.length === 0) return 0;
    return elos.reduce((sum, e) => sum + e, 0) / elos.length;
}

export function validateTournamentParams(
    params: TournamentParams,
    participantCount: number,
    activeCount: number
): string | null {
    const { n, b, k, maxGain, maxRounds } = params;
    if (maxRounds !== null && (!Number.isFinite(maxRounds) || maxRounds < 0)) {
        return 'Please enter a valid Max Rounds value or leave it empty.';
    }
    if (!Number.isFinite(n) || n <= 0) {
        return 'Please enter a valid number of rounds (n).';
    }
    if (!Number.isFinite(b)) {
        return 'Please enter a valid tournament bonus (b).';
    }
    if (!Number.isFinite(k)) {
        return 'Please enter a valid affect value (k).';
    }
    if (!Number.isFinite(maxGain) || maxGain < 0) {
        return 'Please enter a valid max Elo gain.';
    }
    if (participantCount < 1) {
        return 'Please add at least one participant.';
    }
    if (activeCount === 0) {
        return 'There are no active debaters on the roster to calculate an average Elo.';
    }
    return null;
}

export function averageElo(elos: number[]): number {
    if (elos.length === 0) return 0;
    return elos.reduce((sum, e) => sum + e, 0) / elos.length;
}
