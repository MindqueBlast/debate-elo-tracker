import { describe, expect, it } from 'vitest';
import {
    ALL_CLASSES,
    GRADUATED_CLASSES,
    buildEloSeries,
    chartIncludes,
    chartIncludesTeam,
    classOf,
} from './chartSeries';
import type { Debater, Team } from './types';

const person = (id: string, status: Debater['status'], class_year: number | null = 2027): Debater => ({
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
const grad = person('grad', 'graduated', null); // class of 2025 by graduation date
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

    it('puts graduates in the class they graduated with, shown only with the whole team', () => {
        expect(classOf(grad)).toBe(2025);
        expect(classOf(inactive)).toBe(2027);
        expect(classOf({ class_year: null, status: 'active', graduation_date: null })).toBeNull();
        const ids = (selectedId: string, who: 'active' | 'team') =>
            buildEloSeries({ debaters: people, selectedId, who, activeIds }).series.map((s) => s.id);
        expect(ids('class:2025', 'team')).toEqual(['grad']);
        expect(ids('class:2025', 'active')).toEqual([]);
        // current classes is the team; all classes adds graduates; graduated classes is just them
        expect(ids('ALL', 'team')).toEqual(['competed', 'inactive']);
        expect(ids(ALL_CLASSES, 'team')).toEqual(['competed', 'inactive', 'grad']);
        expect(ids(GRADUATED_CLASSES, 'team')).toEqual(['grad']);
        expect(ids(GRADUATED_CLASSES, 'active')).toEqual([]);
        // a graduate can still be picked on their own
        expect(ids('grad', 'team')).toEqual(['grad']);
    });

    it('keeps important dates within the lines shown', () => {
        const done = { ...grad, history: [{ date: '2024-09-01', elo: 700 }, { date: '2025-05-01', elo: 800 }] };
        const annotations = ['2024-08-01', '2024-10-01', '2025-05-01', '2026-10-01'].map((date, i) => ({
            id: String(i), date, name: `t${i}`,
        }));
        const { series } = buildEloSeries({
            debaters: [done], selectedId: 'grad', annotations, showAnnotations: true,
        });
        expect(series.find((s) => s.id === '__annotations__')!.data.map((p) => p.x)).toEqual(['2024-10-01', '2025-05-01']);
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
