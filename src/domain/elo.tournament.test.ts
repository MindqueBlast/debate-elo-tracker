import { describe, expect, it } from 'vitest';
import {
    adjustedWins,
    calculateTournamentElo,
    defaultLost,
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

    it('marks entries as having lost unless they swept a non-invitational', () => {
        expect(defaultLost(30, 6, 6)).toBe(true); // invitational, even after a sweep
        expect(defaultLost(15, 4, 4)).toBe(false); // swept a local
        expect(defaultLost(15, 3, 4)).toBe(true);
        expect(defaultLost(10, 2, 2)).toBe(false); // 2-0 at a Citron
        expect(defaultLost(10, 1, 2)).toBe(true);
    });

    it('never takes Elo from an undefeated entry', () => {
        // a top pair at a weak local: 4-0 would otherwise cost them
        const field = [
            { id: 'w1', name: 'W1', elo: 500, division: 'Varsity' as const, W_raw: 1, n: 4 },
            { id: 'w2', name: 'W2', elo: 500, division: 'Varsity' as const, W_raw: 2, n: 4 },
        ];
        const params = { n: 4, b: 15, k: 45, maxGain: 300, maxRounds: null };
        const top = (lost: boolean | null | undefined) => ({
            id: 'top',
            name: 'Top',
            elo: 1250,
            members: [
                { id: 'x', elo: 1250 },
                { id: 'y', elo: 1260 },
            ],
            division: 'Varsity' as const,
            W_raw: 4,
            n: 4,
            lost,
        });
        const unprotected = calculateTournamentElo([top(null), ...field], params).results[0];
        expect(unprotected.change).toBeLessThan(0);

        const undefeated = calculateTournamentElo([top(false), ...field], params).results[0];
        expect(undefeated.change).toBe(0);
        expect(undefeated.members.map((m) => m.change)).toEqual([0, 0]);

        const lost = calculateTournamentElo([top(true), ...field], params).results[0];
        expect(lost.change).toBeCloseTo(unprotected.change, 9);
    });

    it('leaves gains alone for an undefeated entry', () => {
        const entry = { id: 'a', name: 'A', elo: 400, division: 'Novice' as const, W_raw: 4, n: 4 };
        const params = { n: 4, b: 15, k: 45, maxGain: 300, maxRounds: null };
        const without = calculateTournamentElo([entry], params).results[0].change;
        const withZero = calculateTournamentElo([{ ...entry, lost: false }], params).results[0].change;
        expect(without).toBeGreaterThan(0);
        expect(withZero).toBe(without);
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
