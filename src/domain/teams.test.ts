import { describe, expect, it } from 'vitest';
import { calculateTournamentElo } from './elo';
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

    it('gives both partners the same change and keeps everyone else flat', () => {
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
        expect(out.history.a[1]).toEqual({ date: '2025-09-10', elo: 650 + p.winnerChange });
        expect(out.history.l[1]).toEqual({ date: '2025-09-10', elo: 700 + p.loserChange });
        const e = out.tournaments.t1.entries.e1;
        expect(e.teamElo).toBeCloseTo((900 + p.loserChange + 650 + p.winnerChange) / 2, 10);
        expect(out.elo.j).toBeCloseTo(900 + p.loserChange + e.change, 10);
        expect(out.elo.a).toBeCloseTo(650 + p.winnerChange + e.change, 10);
        // Leon and Chloe sat out: flat marker at the tournament, unchanged Elo
        expect(out.history.l.at(-1)).toEqual({ date: '2025-09-20', elo: out.elo.l, event: 'Tournament' });
        expect(out.elo.c).toBeCloseTo(650 + p.winnerChange, 10);
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
        expect(out.tournaments.t.entries.e.teamElo).toBeCloseTo(800 + out.practice.p.winnerChange, 10);
    });
});
