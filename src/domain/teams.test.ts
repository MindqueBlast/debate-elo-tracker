import { describe, expect, it } from 'vitest';
import { calculatePracticeEloForPairs, calculateTournamentElo } from './elo';
import { practiceRecord } from './ranking';
import { replay, seasonOf } from './replay';
import {
    findTeam,
    lookup,
    pairingHistory,
    pairingLabel,
    rankTeams,
} from './teams';
import type { Debater, PracticeRound, Team } from './types';

const person = (id: string, name: string, elo: number, extra: Partial<Debater> = {}): Debater => ({
    id,
    name,
    elo,
    status: 'active',
    graduation_date: null,
    history: [],
    start_elo: elo,
    start_date: '2024-08-01',
    ...extra,
});

const team = (id: string, a: string, b: string, extra: Partial<Team> = {}): Team => ({
    id,
    name: null,
    member1_id: a,
    member2_id: b,
    division: 'JV',
    season: '2025-26',
    active: true,
    ...extra,
});

describe('pairings and teams', () => {
    const people = [
        person('j', 'Jiayi', 1300),
        person('l', 'Leon', 1100),
        person('a', 'Aaditya', 1000),
        person('c', 'Chloe', 900),
    ];
    const byId = lookup(people);

    it('labels a pairing and marks a missing partner', () => {
        expect(pairingLabel(['j', 'l'], byId)).toBe('Jiayi + Leon');
        expect(pairingLabel(['j', null], byId)).toBe('Jiayi + ?');
    });

    it('ranks teams by the average of their two people', () => {
        const teams = [team('t1', 'a', 'c'), team('t2', 'j', 'l')];
        const ranked = rankTeams(teams, people);
        expect(ranked.map((r) => r.team.id)).toEqual(['t2', 't1']);
        expect(ranked[0].elo).toBe(1200);
        expect(ranked[1].elo).toBe(950);
    });

    it('hides retired teams unless asked', () => {
        const teams = [team('t1', 'a', 'c', { active: false }), team('t2', 'j', 'l')];
        expect(rankTeams(teams, people)).toHaveLength(1);
        expect(rankTeams(teams, people, { showInactive: true })).toHaveLength(2);
    });

    it('finds a saved team regardless of member order', () => {
        const teams = [team('t2', 'j', 'l')];
        expect(findTeam(teams, ['l', 'j'])?.id).toBe('t2');
        expect(findTeam(teams, ['j', 'a'])).toBeUndefined();
    });

    it('builds team Elo over time from both partners', () => {
        const j = person('j', 'Jiayi', 0, {
            history: [
                { date: '2025-09-01', elo: 900 },
                { date: '2025-10-01', elo: 1000 },
            ],
        });
        const l = person('l', 'Leon', 0, {
            history: [
                { date: '2025-09-01', elo: 700 },
                { date: '2025-11-01', elo: 800, event: 'Tournament' },
            ],
        });
        expect(pairingHistory([j, l])).toEqual([
            { x: '2025-09-01', y: 800, event: undefined },
            { x: '2025-10-01', y: 850, event: undefined },
            { x: '2025-11-01', y: 900, event: 'Tournament' },
        ]);
    });

    it('counts practice wins and losses for partners too', () => {
        const rounds: PracticeRound[] = [
            {
                id: '1',
                date: '2025-10-01',
                winner_id: 'j',
                winner_partner_id: 'l',
                loser_id: 'a',
                loser_partner_id: 'c',
                winner_change: 5,
                loser_change: -4,
            },
        ];
        expect(practiceRecord('l', rounds)).toMatchObject({ wins: 1, losses: 0 });
        expect(practiceRecord('c', rounds)).toMatchObject({ wins: 0, losses: 1 });
    });
});

describe('rounds by division', () => {
    const entries = [
        { id: 'v', name: 'V', elo: 900, division: 'Varsity' as const, W_raw: 4 },
        { id: 'n', name: 'N', elo: 400, division: 'Novice' as const, W_raw: 3 },
    ];

    it('matches the single-rounds formula when every entry has the same rounds', () => {
        const plain = calculateTournamentElo(entries, { n: 6, b: 30, k: 45, maxGain: 300, maxRounds: null });
        const split = calculateTournamentElo(
            entries.map((e) => ({ ...e, n: 6 })),
            { n: 6, b: 30, k: 45, maxGain: 300, maxRounds: null }
        );
        expect(split.eTourney).toBeCloseTo(plain.eTourney, 10);
        expect(split.results[0].change).toBeCloseTo(plain.results[0].change, 10);
    });

    it('uses each entry’s own rounds and the average rounds for the phantom teams', () => {
        const params = { n: 6, b: 30, k: 45, maxGain: 300, maxRounds: null };
        const { eTourney, results } = calculateTournamentElo(
            [entries[0], { ...entries[1], n: 5 }],
            params
        );
        // varsity adjusted wins with 6 rounds, novice raw wins (5 rounds doesn't change raw)
        const vAdj = ((-200 / ((4 / 6) * 100 + 4) + 50) / 100) * 6 + 4;
        expect(results[0].W_adjusted).toBeCloseTo(vAdj, 10);
        expect(results[1].W_adjusted).toBe(3);
        expect(eTourney).toBeCloseTo((vAdj + 3 + (3 * 5.5) / 2) / 5, 10);
        expect(results[1].n).toBe(5);
    });
});

describe('replay', () => {
    it('works out seasons from dates', () => {
        expect(seasonOf('2025-09-01')).toBe('2025-26');
        expect(seasonOf('2026-03-01')).toBe('2025-26');
        expect(seasonOf('2026-07-01')).toBe('2026-27');
    });

    it('scores each person on their own Elo and keeps everyone else flat', () => {
        const out = replay({
            people: [
                { id: 'j', startElo: 900, startDate: '2025-08-01', rosterSeasons: ['2025-26'] },
                { id: 'l', startElo: 700, startDate: '2025-08-01', rosterSeasons: ['2025-26'] },
                { id: 'a', startElo: 650, startDate: '2025-08-01', rosterSeasons: ['2025-26'] },
                { id: 'c', startElo: 650, startDate: '2025-08-01', rosterSeasons: ['2025-26'] },
                { id: 'old', startElo: 900, startDate: '2024-08-01', rosterSeasons: ['2024-25'] },
            ],
            practice: [{ id: 'p1', date: '2025-09-10', winner: ['a', 'c'], loser: ['j', 'l'] }],
            tournaments: [
                {
                    id: 't1',
                    date: '2025-09-20',
                    params: { n: 4, b: 15, k: 45, maxGain: 300, maxRounds: null },
                    entries: [{ id: 'e1', members: ['j', 'a'], division: 'Varsity', rawWins: 3 }],
                },
            ],
        });
        const p = out.practice.p1;
        expect(p.winnerElo).toBe(650);
        expect(p.loserElo).toBe(800);
        // the lower-rated loser (Leon, 700) loses less than the higher-rated one (900)
        expect(p.changes.l).toBeGreaterThan(p.changes.j);
        expect(out.history.a[1]).toEqual({ date: '2025-09-10', elo: 650 + p.changes.a });
        expect(out.history.l[1]).toEqual({ date: '2025-09-10', elo: 700 + p.changes.l });

        const e = out.tournaments.t1.entries.e1;
        const jIn = 900 + p.changes.j;
        const aIn = 650 + p.changes.a;
        expect(e.teamElo).toBeCloseTo((jIn + aIn) / 2, 10);
        // same result, own Elo: the higher-rated partner gains less
        expect(e.changes.j).toBeLessThan(e.changes.a);
        expect(e.change).toBeCloseTo((e.changes.j + e.changes.a) / 2, 10);
        expect(out.elo.j).toBeCloseTo(jIn + e.changes.j, 10);
        expect(out.elo.a).toBeCloseTo(aIn + e.changes.a, 10);
        // Leon and Chloe sat out: flat marker at the tournament, unchanged Elo
        expect(out.history.l.at(-1)).toEqual({ date: '2025-09-20', elo: out.elo.l, event: 'Tournament' });
        expect(out.elo.c).toBeCloseTo(650 + p.changes.c, 10);
        // someone from a past season gets no marker
        expect(out.history.old).toHaveLength(1);
    });

    it('runs practice rounds before tournaments on the same day', () => {
        const out = replay({
            people: [
                { id: 'x', startElo: 800, startDate: '2025-08-01' },
                { id: 'y', startElo: 800, startDate: '2025-08-01' },
            ],
            practice: [{ id: 'p', date: '2025-10-01', winner: ['x'], loser: ['y'] }],
            tournaments: [
                {
                    id: 't',
                    date: '2025-10-01',
                    params: { n: 2, b: 10, k: 45, maxGain: 300, maxRounds: null },
                    entries: [{ id: 'e', members: ['x'], division: 'Novice', rawWins: 2 }],
                },
            ],
        });
        expect(out.tournaments.t.entries.e.teamElo).toBeCloseTo(800 + out.practice.p.changes.x, 10);
    });
});

describe('individual changes', () => {
    const params = { n: 6, b: 30, k: 45, maxGain: 300, maxRounds: null };

    it('uses each partner’s own Elo for their change, with the same adjusted wins and E', () => {
        const pair = { id: 'e', name: 'J+L', elo: 1200, division: 'Varsity' as const, W_raw: 6 };
        const solo = calculateTournamentElo([pair], params);
        const { eTourney, results } = calculateTournamentElo(
            [{ ...pair, members: [{ id: 'j', elo: 1300 }, { id: 'l', elo: 1100 }] }],
            params
        );
        expect(eTourney).toBeCloseTo(solo.eTourney, 12);
        expect(results[0].W_adjusted).toBeCloseTo(solo.results[0].W_adjusted, 12);
        const [j, l] = results[0].members;
        // each person's adjusted wins against what's expected of someone at their Elo (p × E)
        const expected = (elo: number) =>
            45 * (results[0].W_adjusted - Math.pow(elo / 700, 1.5) * eTourney) + 30;
        expect(j.change).toBeCloseTo(expected(1300), 10);
        expect(l.change).toBeCloseTo(expected(1100), 10);
        expect(j.change).toBeLessThan(l.change);
        expect(results[0].change).toBeCloseTo((j.change + l.change) / 2, 10);
    });

    it('caps and protects each partner separately', () => {
        const { results } = calculateTournamentElo(
            [
                {
                    id: 'e',
                    name: 'pair',
                    elo: 700,
                    members: [{ id: 'low', elo: 300 }, { id: 'high', elo: 1500 }],
                    division: 'Novice',
                    W_raw: 4,
                },
                { id: 'f', name: 'other', elo: 700, division: 'Novice', W_raw: 4 },
            ],
            { n: 4, b: 15, k: 45, maxGain: 150, maxRounds: 4 }
        );
        const [low, high] = results[0].members;
        expect(low.change).toBe(150); // capped
        expect(high.change).toBeGreaterThanOrEqual(0); // undefeated never loses Elo
    });

    it('scores practice-round partners on their own Elo', () => {
        const r = calculatePracticeEloForPairs(
            [{ id: 'w1', elo: 1000 }, { id: 'w2', elo: 600 }],
            [{ id: 'l1', elo: 800 }, { id: 'l2', elo: 800 }]
        );
        expect(r.expected).toBeCloseTo(0.5, 10);
        const [w1, w2] = r.winners;
        expect(w1.change).toBeCloseTo(25 * (1 - 1 / (1 + Math.pow(10, (800 - 1000) / 400))), 10);
        expect(w2.change).toBeGreaterThan(w1.change);
        expect(r.losers[0].change).toBeCloseTo(-7.5, 10);
    });
});
