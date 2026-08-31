import { describe, expect, it } from 'vitest';
import {
    calculatePracticeElo,
    expectedScore,
    validatePracticeMatch,
} from './elo';

describe('practice Elo', () => {
    it('gives a 50% expected score when Elos are equal', () => {
        expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
    });

    it('applies the existing win/loss formula for equal ratings', () => {
        const result = calculatePracticeElo(1500, 1500);
        expect(result.winnerChange).toBeCloseTo(57.5);
        expect(result.loserChange).toBeCloseTo(-42.5);
        expect(result.newWinnerElo).toBeCloseTo(1557.5);
        expect(result.newLoserElo).toBeCloseTo(1457.5);
    });

    it('awards a small gain when a much stronger player wins', () => {
        const result = calculatePracticeElo(2000, 1000);
        expect(result.expected).toBeGreaterThan(0.99);
        expect(result.winnerChange).toBeLessThan(2);
        // Existing formula credits the loser a 15E bonus, which can net positive
        // when a heavy favorite wins.
        expect(result.loserChange).toBeGreaterThan(10);
    });

    it('awards a large gain when a much weaker player wins', () => {
        const result = calculatePracticeElo(1000, 2000);
        expect(result.winnerChange).toBeGreaterThan(100);
        expect(result.loserChange).toBeLessThan(-80);
    });

    it('compounds correctly across repeated equal matches', () => {
        let a = 1500;
        let b = 1500;
        for (let i = 0; i < 3; i++) {
            const r = calculatePracticeElo(a, b);
            a = r.newWinnerElo;
            b = r.newLoserElo;
        }
        expect(a).toBeGreaterThan(1500);
        expect(b).toBeLessThan(1500);
        expect(a + b).toBeCloseTo(3000 + 3 * 15, 5);
    });

    it('rejects missing or identical players', () => {
        expect(validatePracticeMatch('', 'b')).toBeTruthy();
        expect(validatePracticeMatch('a', 'a')).toBeTruthy();
        expect(validatePracticeMatch('a', 'b')).toBeNull();
    });
});
