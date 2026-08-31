import { describe, expect, it } from 'vitest';
import {
    adjustedWins,
    calculateTournamentElo,
    validateTournamentParams,
} from './elo';

describe('tournament Elo', () => {
    it('leaves novice wins unadjusted', () => {
        expect(adjustedWins('Novice', 4, 6)).toBe(4);
    });

    it('raises JV and Varsity adjusted wins above raw', () => {
        const jv = adjustedWins('JV', 4, 6);
        const varsity = adjustedWins('Varsity', 4, 6);
        expect(jv).toBeGreaterThan(4);
        expect(varsity).toBeGreaterThan(jv);
    });

    it('caps gain at maxGain', () => {
        const { results } = calculateTournamentElo(
            [
                {
                    id: 'a',
                    name: 'A',
                    elo: 400,
                    division: 'Novice',
                    W_raw: 12,
                },
            ],
            { n: 6, b: 0, k: 45, maxGain: 5, maxRounds: null }
        );
        expect(results[0].change).toBe(5);
    });

    it('zeroes a loss when max-rounds undefeated', () => {
        const { results } = calculateTournamentElo(
            [
                {
                    id: 'a',
                    name: 'A',
                    elo: 2200,
                    division: 'Novice',
                    W_raw: 6,
                },
                {
                    id: 'b',
                    name: 'B',
                    elo: 1000,
                    division: 'Novice',
                    W_raw: 0,
                },
            ],
            { n: 6, b: 0, k: 45, maxGain: 300, maxRounds: 6 }
        );
        const a = results.find((r) => r.id === 'a')!;
        expect(a.change).toBeGreaterThanOrEqual(0);
    });

    it('treats empty maxRounds as valid', () => {
        expect(
            validateTournamentParams(
                { n: 6, b: 2, k: 45, maxGain: 300, maxRounds: null },
                2,
                4
            )
        ).toBeNull();
    });

    it('rejects empty fields and empty roster', () => {
        expect(
            validateTournamentParams(
                { n: 0, b: 0, k: 45, maxGain: 300, maxRounds: null },
                1,
                1
            )
        ).toBeTruthy();
        expect(
            validateTournamentParams(
                { n: 6, b: 0, k: 45, maxGain: 300, maxRounds: null },
                0,
                1
            )
        ).toBeTruthy();
        expect(
            validateTournamentParams(
                { n: 6, b: 0, k: 45, maxGain: 300, maxRounds: null },
                1,
                0
            )
        ).toBeTruthy();
    });
});
