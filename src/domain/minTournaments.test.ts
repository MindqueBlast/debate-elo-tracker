import { describe, expect, it } from 'vitest';
import { buildEloSeries, tournamentCounts } from './chartSeries';
import type { Debater, Tournament } from './types';

const d = (id: string): Debater =>
    ({ id, name: id, elo: 500, status: 'active', division: 'JV', class_year: 2029, history: [{ date: '2025-09-01', elo: 500 }] }) as unknown as Debater;
const t = (id: string, pairs: [string, string | null][]): Tournament =>
    ({
        id,
        name: id,
        date: '2025-10-01',
        tournament_participants: pairs.map(([a, b], i) => ({ id: `${id}-${i}`, debater_id: a, partner_id: b })),
    }) as unknown as Tournament;

describe('minimum tournaments', () => {
    const tournaments = [t('t1', [['a', 'b']]), t('t2', [['a', 'c']]), t('t3', [['a', 'b'], ['c', null]])];

    it('counts each person once per tournament, and pairs together', () => {
        const c = tournamentCounts(tournaments);
        expect(Object.fromEntries(c.people)).toEqual({ a: 3, b: 2, c: 2 });
        expect(c.pairs.get('a|b')).toBe(2);
    });

    it('drops lines under the minimum and reports the whole field', () => {
        const debaters = ['a', 'b', 'c', 'e'].map(d);
        const r = buildEloSeries({ debaters, selectedId: 'ALL', classes: ['class:2029'], who: 'team', tournaments, minTournaments: 3 });
        expect(r.series.map((s) => s.id)).toEqual(['a']);
        expect([...(r.fieldCounts ?? [])].sort()).toEqual([0, 2, 2, 3]);
    });
});
