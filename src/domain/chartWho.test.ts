import { describe, expect, it } from 'vitest';
import { buildEloSeries, chartIncludes, chartIncludesTeam } from './chartSeries';
import type { Debater, Team } from './types';

const person = (id: string, status: Debater['status'], class_year = 2027): Debater => ({
    id,
    name: id,
    elo: 800,
    status,
    graduation_date: status === 'graduated' ? '2025-06-30' : null,
    history: [{ date: '2025-09-01', elo: 800 }],
    class_year,
    start_elo: 400,
    start_date: '2023-08-01',
});

const competed = person('competed', 'active');
const inactive = person('inactive', 'active'); // on the team, didn't compete this season
const grad = person('grad', 'graduated');
const people = [competed, inactive, grad];
const activeIds = new Set(['competed']);

describe('who a chart lists', () => {
    it('separates this season, the whole team and graduates', () => {
        const names = (who: 'active' | 'team' | 'all') =>
            people.filter((d) => chartIncludes(d, who, activeIds)).map((d) => d.id);
        expect(names('active')).toEqual(['competed']);
        expect(names('team')).toEqual(['competed', 'inactive']);
        expect(names('all')).toEqual(['competed', 'inactive', 'grad']);
    });

    it('draws inactive people in a class view only when asked', () => {
        const ids = (who: 'active' | 'team') =>
            buildEloSeries({ debaters: people, selectedId: 'class:2027', who, activeIds }).series.map((s) => s.id);
        expect(ids('active')).toEqual(['competed']);
        expect(ids('team')).toEqual(['competed', 'inactive']);
    });

    it('keeps an old pairing when both people are still on the team', () => {
        const byId = new Map(people.map((d) => [d.id, d]));
        const team = (a: string, b: string, active: boolean): Team => ({
            id: `${a}+${b}`, name: null, member1_id: a, member2_id: b, division: null, season: null, active,
        });
        expect(chartIncludesTeam(team('competed', 'inactive', false), 'active', byId)).toBe(false);
        expect(chartIncludesTeam(team('competed', 'inactive', false), 'team', byId)).toBe(true);
        expect(chartIncludesTeam(team('competed', 'grad', false), 'team', byId)).toBe(false);
        expect(chartIncludesTeam(team('competed', 'grad', false), 'all', byId)).toBe(true);
    });
});
