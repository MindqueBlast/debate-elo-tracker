import type {
    PracticeEloResult,
    TournamentParams,
    TournamentParticipantInput,
    TournamentResult,
} from './types';

export function expectedScore(winnerElo: number, loserElo: number): number {
    return 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
}

export function calculatePracticeElo(
    winnerElo: number,
    loserElo: number
): PracticeEloResult {
    const E = expectedScore(winnerElo, loserElo);
    const winnerChange = 115 * (1 - E);
    const loserChange = -100 * (1 - E) + 15 * E;
    return {
        expected: E,
        winnerChange,
        loserChange,
        newWinnerElo: winnerElo + winnerChange,
        newLoserElo: loserElo + loserChange,
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

export function calculateTournamentElo(
    participants: TournamentParticipantInput[],
    params: TournamentParams,
    activeAverageElo: number
): { eTourney: number; results: TournamentResult[] } {
    const { n, b, k, maxGain, maxRounds } = params;
    const t = participants.length;
    let s = 0;
    const withAdjusted = participants.map((p) => {
        const W_adjusted = adjustedWins(p.division, p.W_raw, n);
        s += W_adjusted;
        return { ...p, W_adjusted };
    });

    const eTourney = (s + (3 * n) / 2) / (t + 3);

    const results: TournamentResult[] = withAdjusted.map((p) => {
        const p_prop = Math.pow(p.elo / activeAverageElo, 1.5);
        let C = k * (p.W_adjusted / p_prop - eTourney) + b;
        if (maxRounds !== null && p.W_raw === maxRounds && C < 0) {
            C = 0;
        }
        if (C > maxGain) {
            C = maxGain;
        }
        return {
            id: p.id,
            name: p.name,
            oldElo: p.elo,
            newElo: p.elo + C,
            change: C,
            W_adjusted: p.W_adjusted,
            p_value: p_prop,
            W_raw: p.W_raw,
            division: p.division,
        };
    });

    return { eTourney, results };
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
