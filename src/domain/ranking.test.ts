import { describe, expect, it } from 'vitest';
import { rankDebaters } from './ranking';
import type { Debater, PracticeRound } from './types';

const d = (
    id: string,
    name: string,
    elo: number,
    status: Debater['status'] = 'active'
): Debater => ({
    id,
    name,
    elo,
    status,
    graduation_date: status === 'graduated' ? '2025' : null,
    history: [],
});

describe('rankings', () => {
    const rounds: PracticeRound[] = [
        {
            id: '1',
            date: '2024-01-01',
            winner_id: 'a',
            loser_id: 'b',
            winner_change: 10,
            loser_change: -8,
        },
    ];

    it('orders by Elo descending then name', () => {
        const ranked = rankDebaters(
            [d('b', 'Ben', 1500), d('a', 'Ada', 1600), d('c', 'Cal', 1500)],
            rounds
        );
        expect(ranked.map((r) => r.id)).toEqual(['a', 'b', 'c']);
        expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    });

    it('does not skip ranks when graduated players are hidden', () => {
        const ranked = rankDebaters(
            [d('g', 'Grad', 1800, 'graduated'), d('a', 'Ada', 1500)],
            [],
            { showGraduated: false }
        );
        expect(ranked).toHaveLength(1);
        expect(ranked[0].rank).toBe(1);
        expect(ranked[0].id).toBe('a');
    });

    it('includes win rate from practice rounds', () => {
        const ranked = rankDebaters([d('a', 'Ada', 1600), d('b', 'Ben', 1500)], rounds);
        expect(ranked[0].wins).toBe(1);
        expect(ranked[0].winRate).toBe(100);
        expect(ranked[1].losses).toBe(1);
        expect(ranked[1].winRate).toBe(0);
    });
});
