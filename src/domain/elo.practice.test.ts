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

    it('applies the live win/loss formula for equal ratings', () => {
        const result = calculatePracticeElo(1500, 1500);
        expect(result.winnerChange).toBeCloseTo(12.5);
        expect(result.loserChange).toBeCloseTo(-7.5);
        expect(result.newWinnerElo).toBeCloseTo(1512.5);
        expect(result.newLoserElo).toBeCloseTo(1492.5);
    });

    it('awards a small gain when a much stronger player wins', () => {
        const result = calculatePracticeElo(2000, 1000);
        expect(result.expected).toBeGreaterThan(0.99);
        expect(result.winnerChange).toBeLessThan(1);
        expect(result.loserChange).toBeGreaterThan(4);
    });

    it('awards a large gain when a much weaker player wins', () => {
        const result = calculatePracticeElo(1000, 2000);
        expect(result.winnerChange).toBeGreaterThan(20);
        expect(result.loserChange).toBeLessThan(-15);
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
        expect(a + b).toBeCloseTo(3000 + 3 * 5, 5);
    });

    it('rejects missing or identical players', () => {
        expect(validatePracticeMatch('', 'b')).toBeTruthy();
        expect(validatePracticeMatch('a', 'a')).toBeTruthy();
        expect(validatePracticeMatch('a', 'b')).toBeNull();
    });
});
