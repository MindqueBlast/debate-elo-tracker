import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig, validateConfig, withEloConfig, typeName } from './config';
import { applyChanges, invertChanges, stillAsSaved, type Changes, type State } from './changes';
import { dataChecks, mergeChanges, newSeasonChanges, planNewSeason, scoringRewrite, startEloFixes, startEloFor, wasFreshman } from './admin';
import { computeAll, gradeInputs, type InputEntry, type InputPerson, type Inputs, type InputTournament } from './rebuild';
import type { Team } from './types';

const person = (id: string, extra: Partial<InputPerson> = {}): InputPerson => ({
    id,
    name: id,
    division: 'Varsity',
    status: 'active',
    graduation_date: null,
    class_year: 2027,
    start_elo: 800,
    start_date: '2024-08-01',
    ...extra,
});

const entry = (id: string, a: string, b: string | null, raw: number, division: InputEntry['division'] = 'Varsity'): InputEntry => ({
    id,
    debater_id: a,
    partner_id: b,
    team_id: null,
    division,
    raw_wins: raw,
    rounds: 6,
    lost: null,
});

const tournament = (id: string, date: string, entries: InputEntry[], extra: Partial<InputTournament> = {}): InputTournament => ({
    id,
    date,
    name: id,
    bonus: 30,
    affect: 45,
    max_gain: null,
    max_rounds: null,
    entries,
    ...extra,
});

const team = (id: string, a: string, b: string): Team => ({
    id,
    name: null,
    member1_id: a,
    member2_id: b,
    division: 'Varsity',
    season: '2025-26',
    active: true,
});

const base = (): Inputs => ({
    people: [person('a'), person('b'), person('c', { start_elo: 400, division: 'Novice' }), person('d', { start_elo: 400, division: 'Novice' })],
    tournaments: [
        tournament('t1', '2025-10-04', [entry('e1', 'a', 'b', 5), entry('e2', 'c', 'd', 2, 'Novice')]),
        tournament('t2', '2025-11-08', [entry('e3', 'a', 'b', 3), entry('e4', 'c', 'd', 4, 'Novice')], { bonus: 15 }),
    ],
    practice: [],
    adjustments: [],
});

const stateOf = (inputs: Inputs, teams: Team[] = []): State => ({ inputs, teams, annotations: [] });
const TODAY = '2026-11-26';

describe('scoring settings', () => {
    it('fills anything missing or broken with the defaults', () => {
        expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
        const c = parseConfig({ k: '50', bars: { JV: 720, Novice: -3 }, phantoms: 2 });
        expect(c.k).toBe(50);
        expect(c.bars).toEqual({ Novice: 550, JV: 720, Varsity: 850 });
        expect(c.phantoms).toBe(2);
    });

    it('refuses two types with the same bonus', () => {
        expect(validateConfig(DEFAULT_CONFIG)).toBeNull();
        expect(validateConfig({ ...DEFAULT_CONFIG, bonuses: { invitational: 30, local: 10, citron: 10 } })).toMatch(/own bonus/);
    });

    it('names a tournament’s type from its bonus under the settings given', () => {
        expect(typeName(30)).toBe('Invitational');
        expect(typeName(12)).toBe('Bonus 12');
        expect(typeName(35, { ...DEFAULT_CONFIG, bonuses: { invitational: 35, local: 15, citron: 10 } })).toBe('Invitational');
    });

    it('changes the math only inside withEloConfig', () => {
        const inputs = base();
        const before = computeAll(inputs, TODAY).people.a.elo;
        const harder = withEloConfig({ ...DEFAULT_CONFIG, bars: { ...DEFAULT_CONFIG.bars, Varsity: 1000 } }, () =>
            computeAll(inputs, TODAY)
        ).people.a.elo;
        expect(harder).toBeGreaterThan(before); // a higher bar makes the same record worth more
        expect(computeAll(inputs, TODAY).people.a.elo).toBeCloseTo(before, 10);
        const fewer = withEloConfig({ ...DEFAULT_CONFIG, phantoms: 0 }, () => computeAll(inputs, TODAY));
        expect(fewer.tournaments.t1.e_tourney).toBeCloseTo((5 + 2) / 2, 10);
    });

    it('rewrites only the records that followed the old settings', () => {
        const inputs = base();
        inputs.tournaments.push(tournament('t3', '2025-12-01', [entry('e5', 'a', null, 2)], { bonus: 12, affect: 30 }));
        inputs.people.push(person('e', { start_elo: 650, division: 'JV' }));
        const to = { ...DEFAULT_CONFIG, k: 50, bonuses: { invitational: 35, local: 15, citron: 10 }, startElo: { Novice: 450, JV: 600, Varsity: 800 } };
        const r = scoringRewrite(inputs, DEFAULT_CONFIG, to);
        expect(r.tournaments.map((t) => [t.id, t.bonus, t.affect])).toEqual([
            ['t1', 35, 50],
            ['t2', 15, 50],
        ]);
        // c and d started at the novice default; e's 650 was set by hand
        expect(r.people.map((p) => [p.id, p.start_elo])).toEqual([
            ['c', 450],
            ['d', 450],
        ]);
    });
});

describe('unrated tournaments and grading', () => {
    it('keeps an unrated tournament on the list without moving anyone', () => {
        const inputs = base();
        const rated = computeAll(inputs, TODAY);
        inputs.tournaments[1] = { ...inputs.tournaments[1], rated: false };
        const off = computeAll(inputs, TODAY);
        expect(off.entries.e3.elo_change).toBe(0);
        expect(off.people.a.elo).not.toBeCloseTo(rated.people.a.elo, 3);
        expect(off.people.a.history.every((h) => h.date !== '2025-11-08' || h.elo === off.people.a.history[1].elo)).toBe(true);
    });

    it('grades each entry against the wins its Elo called for', () => {
        const g = gradeInputs(base(), TODAY);
        expect(g.entries).toBe(4);
        expect(g.miss).toBeGreaterThan(0);
        expect(g.called).toBeNull();
    });
});

describe('undo', () => {
    it('puts things back exactly, for adds, edits and removals', () => {
        const teams = [team('tm1', 'a', 'b'), team('tm2', 'c', 'd')];
        const s = stateOf(base(), teams);
        const change: Changes = {
            people_upsert: [person('n', { name: 'New' }), { ...s.inputs.people[0], name: 'A2' }],
            tournaments_upsert: [{ ...s.inputs.tournaments[0], name: 'Renamed', entries: undefined } as never],
            entries_upsert: [{ ...entry('e9', 'n', null, 3), tournament_id: 't2' }],
            entries_delete: ['e2'],
            tournaments_delete: [],
            people_delete: ['d'],
            annotations_insert: [{ date: '2025-11-08', name: 't2' }],
        };
        const after = applyChanges(s, change);
        expect(after.teams.map((t) => t.id)).toEqual(['tm1']); // d's team went with d
        const back = invertChanges(s, change);
        const restored = applyChanges(after, back);
        const norm = (x: State) =>
            JSON.stringify({
                people: [...x.inputs.people].sort((a, b) => a.id.localeCompare(b.id)),
                tournaments: x.inputs.tournaments
                    .map((t) => ({ ...t, entries: [...t.entries].sort((a, b) => a.id.localeCompare(b.id)) }))
                    .sort((a, b) => a.id.localeCompare(b.id)),
                teams: [...x.teams].sort((a, b) => a.id.localeCompare(b.id)),
                annotations: x.annotations,
            });
        expect(norm(restored)).toBe(norm(s));
    });

    it('knows when a later save touched the same rows', () => {
        const s = stateOf(base());
        const change: Changes = { people_upsert: [{ ...s.inputs.people[0], name: 'A2' }] };
        const after = applyChanges(s, change);
        expect(stillAsSaved(after, change)).toBe(true);
        const later = applyChanges(after, { people_upsert: [{ ...s.inputs.people[0], name: 'A3' }] });
        expect(stillAsSaved(later, change)).toBe(false);
    });
});

describe('new season', () => {
    it('graduates the class and moves everyone else up a division', () => {
        const inputs = base();
        inputs.people[2] = { ...inputs.people[2], class_year: 2029 };
        inputs.people[3] = { ...inputs.people[3], class_year: 2029, division: 'JV' };
        const plan = planNewSeason(inputs, 2027);
        expect(plan.graduating.map((p) => p.id)).toEqual(['a', 'b']);
        expect(plan.movingUp.map((m) => [m.person.id, m.to])).toEqual([
            ['c', 'JV'],
            ['d', 'Varsity'],
        ]);
        const c = newSeasonChanges(stateOf(inputs, [team('tm1', 'a', 'b')]), 2027, { graduate: ['a'], moveUp: ['c'] });
        expect(c.people_upsert?.map((p) => [p.id, p.status, p.graduation_date, p.division])).toEqual([
            ['a', 'graduated', '2027-06-30', 'Varsity'],
            ['c', 'active', null, 'JV'],
        ]);
        expect(c.teams_upsert?.map((t) => [t.id, t.active])).toEqual([['tm1', false]]);
    });
});

describe('merging', () => {
    it('moves every result to the person kept, then removes the extra', () => {
        const inputs = base();
        inputs.people.push(person('a2', { name: 'a', start_date: '2024-01-01' }));
        inputs.tournaments.push(tournament('t3', '2025-12-01', [entry('e5', 'a2', 'c', 4)]));
        const s = stateOf(inputs, [team('tm1', 'a2', 'c')]);
        const c = mergeChanges(s, 'a', 'a2');
        expect(c.people_delete).toEqual(['a2']);
        expect(c.entries_upsert?.map((e) => [e.id, e.debater_id, e.partner_id])).toEqual([['e5', 'a', 'c']]);
        expect(c.teams_upsert?.map((t) => [t.member1_id, t.member2_id])).toEqual([['a', 'c']]);
        expect(c.people_upsert?.[0].start_date).toBe('2024-01-01');
        const merged = applyChanges(s, c);
        expect(merged.inputs.people.some((p) => p.id === 'a2')).toBe(false);
        expect(computeAll(merged.inputs, TODAY).people.a).toBeDefined();
    });
});

describe('data checks', () => {
    it('finds people entered twice, someone in two entries, and future dates', () => {
        const inputs = base();
        inputs.people.push(person('A.', { name: 'A' }));
        inputs.tournaments.push(tournament('t3', '2027-01-01', [entry('e5', 'b', null, 2), entry('e6', 'b', 'c', 1)]));
        const ids = dataChecks(stateOf(inputs), TODAY).map((c) => c.id);
        expect(ids).toContain('dupe-people');
        expect(ids).toContain('person-twice');
        expect(ids).toContain('future');
        expect(ids).toContain('no-partner');
    });

    it('doesn’t call two people who debated together duplicates', () => {
        const inputs = base();
        inputs.people[1] = { ...inputs.people[1], name: 'a' };
        expect(dataChecks(stateOf(inputs), TODAY).map((c) => c.id)).not.toContain('dupe-people');
    });
});

describe('starting Elo', () => {
    it('knows a freshman by class year and season', () => {
        expect(wasFreshman(2030, '2026-10-02')).toBe(true);
        expect(wasFreshman(2029, '2026-10-02')).toBe(false);
        expect(wasFreshman(null, '2026-10-02')).toBe(false);
    });

    it('starts freshmen at the novice number, older newcomers at their division’s', () => {
        const inputs = base();
        inputs.people.push(
            person('fr', { class_year: 2030, division: 'JV', start_elo: 600, start_date: '2026-08-01' }),
            person('so', { class_year: 2029, division: 'JV', start_elo: 400, start_date: '2026-08-01' }),
            person('hand', { class_year: 2030, division: 'JV', start_elo: 650, start_date: '2026-08-01' })
        );
        inputs.tournaments.push(
            tournament('t9', '2026-10-02', [entry('e9', 'fr', 'so', 3, 'JV'), entry('e10', 'hand', null, 2, 'JV')])
        );
        expect(startEloFor(inputs.people.find((p) => p.id === 'fr')!, inputs, DEFAULT_CONFIG)).toBe(400);
        expect(startEloFor(inputs.people.find((p) => p.id === 'so')!, inputs, DEFAULT_CONFIG)).toBe(600);
        // a and b are class of 2027, first seen at varsity as juniors
        expect(startEloFor(inputs.people[0], inputs, DEFAULT_CONFIG)).toBe(800);
        expect(startEloFixes(inputs, DEFAULT_CONFIG).map((p) => [p.id, p.start_elo])).toEqual([
            ['fr', 400],
            ['so', 600],
        ]);
    });
});
