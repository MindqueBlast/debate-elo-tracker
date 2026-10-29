import { describe, expect, it } from 'vitest';
import { competedIn, latestSeason, seasonLabel } from './activity';
import { rankDebaters } from './ranking';
import type { Debater, Tournament } from './types';

const t = (id: string, date: string, people: [string, string | null][]): Tournament => ({
    id,
    date,
    name: id,
    e_tourney: 3,
    tournament_participants: people.map(([a, b]) => ({
        tournament_id: id,
        debater_id: a,
        partner_id: b,
        raw_wins: 3,
        adjusted_wins: 3,
        elo_change: 0,
        division: 'Varsity',
    })),
});

const person = (id: string, elo: number, status: Debater['status'] = 'active'): Debater => ({
    id,
    name: id,
    elo,
    status,
    graduation_date: null,
    history: [],
    start_elo: elo,
    start_date: '2024-08-01',
});

describe('who counts as active', () => {
    const tournaments = [
        t('old', '2024-12-06', [['a', 'b']]),
        t('spring', '2026-04-18', [['c', 'd']]),
        t('june', '2026-06-14', [['e', null]]),
    ];

    it('uses the latest season with results until this season has some', () => {
        expect(latestSeason(tournaments, '2026-10-28')).toBe('2025-26');
        expect(latestSeason([...tournaments, t('fall', '2026-10-03', [['a', null]])], '2026-10-28')).toBe(
            '2026-27'
        );
        expect(latestSeason([], '2026-10-28')).toBe('2026-27');
        expect(seasonLabel('2025-26')).toBe('2025–26');
    });

    it('is everyone with a result that season, partners included', () => {
        expect([...competedIn(tournaments, '2025-26')].sort()).toEqual(['c', 'd', 'e']);
    });

    it('ranks only active people when asked', () => {
        const people = [person('a', 1300), person('c', 1200), person('d', 900), person('z', 1000, 'graduated')];
        const ranked = rankDebaters(people, [], { only: new Set(['c', 'd']) });
        expect(ranked.map((r) => [r.id, r.rank])).toEqual([
            ['c', 1],
            ['d', 2],
        ]);
    });
});
