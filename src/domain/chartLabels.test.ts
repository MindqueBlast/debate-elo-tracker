import { describe, expect, it } from 'vitest';
import { ALL_TEAMS, buildEloSeries, teamKey } from './chartSeries';
import { buildEventIndex, describeDay } from './describe';
import { lookup } from './teams';
import type { Debater, PracticeRound, Team, Tournament } from './types';
import { adjacentAnchor, zoomWindow } from './zoom';

describe('zoom windows', () => {
    it('zooms a February date into its season, half, quarter, month and week', () => {
        const anchor = '2024-02-24';
        expect(zoomWindow(0, anchor)).toBeNull();
        expect(zoomWindow(1, anchor)).toEqual({
            start: '2023-08-01',
            end: '2024-08-01',
            label: '2023–24 season',
        });
        expect(zoomWindow(2, anchor)).toEqual({
            start: '2024-02-01',
            end: '2024-08-01',
            label: 'Feb – Jul 2024',
        });
        expect(zoomWindow(3, anchor)).toEqual({
            start: '2024-02-01',
            end: '2024-05-01',
            label: 'Feb – Apr 2024',
        });
        expect(zoomWindow(4, anchor)).toEqual({
            start: '2024-02-01',
            end: '2024-03-01',
            label: 'February 2024',
        });
        // Feb 24, 2024 was a Saturday
        expect(zoomWindow(5, anchor)).toEqual({
            start: '2024-02-19',
            end: '2024-02-26',
            label: 'Feb 19 – 25, 2024',
        });
    });

    it('keeps the fall half and quarters inside the season across new year', () => {
        expect(zoomWindow(1, '2023-12-02')?.label).toBe('2023–24 season');
        expect(zoomWindow(2, '2023-12-02')).toMatchObject({
            start: '2023-08-01',
            end: '2024-02-01',
            label: 'Aug 2023 – Jan 2024',
        });
        expect(zoomWindow(3, '2024-01-15')).toMatchObject({
            start: '2023-11-01',
            end: '2024-02-01',
            label: 'Nov 2023 – Jan 2024',
        });
        expect(zoomWindow(1, '2024-07-31')?.label).toBe('2023–24 season');
        expect(zoomWindow(1, '2024-08-01')?.label).toBe('2024–25 season');
    });

    it('labels a week that crosses two months', () => {
        expect(zoomWindow(5, '2024-03-01')).toEqual({
            start: '2024-02-26',
            end: '2024-03-04',
            label: 'Feb 26 – Mar 3, 2024',
        });
    });

    it('steps to the neighbouring window', () => {
        expect(adjacentAnchor(1, '2024-02-24', 1)).toBe('2024-08-01');
        expect(adjacentAnchor(1, '2024-02-24', -1)).toBe('2023-07-31');
        expect(zoomWindow(4, adjacentAnchor(4, '2024-03-10', -1))?.label).toBe('February 2024');
        expect(zoomWindow(5, adjacentAnchor(5, '2024-01-03', -1))?.start).toBe('2023-12-25');
    });
});

const person = (id: string, name: string, history: Debater['history']): Debater => ({
    id,
    name,
    elo: history[history.length - 1].elo,
    status: 'active',
    graduation_date: null,
    history,
});

const princeton: Tournament = {
    id: 't1',
    date: '2024-12-06',
    name: 'Princeton',
    e_tourney: 3,
    bonus: 30,
    affect: 45,
    max_gain: 300,
    max_rounds: null,
    tournament_participants: [
        {
            tournament_id: 't1',
            debater_id: 'j',
            partner_id: 'l',
            raw_wins: 5,
            adjusted_wins: 5,
            elo_change: 12.34,
            partner_elo_change: 10.06,
            division: 'Varsity',
        },
    ],
};

const people = [
    person('j', 'Jiayi', [
        { date: '2024-08-01', elo: 1100 },
        { date: '2024-12-06', elo: 1112.34, event: 'Tournament' },
    ]),
    person('l', 'Leon', [
        { date: '2024-08-01', elo: 1078 },
        { date: '2024-12-06', elo: 1088.06, event: 'Tournament' },
    ]),
    person('a', 'Aaditya', [
        { date: '2024-08-01', elo: 950 },
        { date: '2024-12-06', elo: 950, event: 'Tournament' },
    ]),
];

describe('point labels', () => {
    const practice: PracticeRound = {
        id: 'p1',
        date: '2024-10-01',
        winner_id: 'a',
        loser_id: 'j',
        winner_partner_id: null,
        loser_partner_id: 'l',
        winner_change: 14,
        loser_change: -9,
        winner_partner_change: null,
        loser_partner_change: -8,
    };
    const index = buildEventIndex([princeton], [practice], lookup(people));

    it('names the tournament and the change for that person', () => {
        expect(describeDay(['l'], '2024-12-06', index, 'tournament')).toBe('Princeton +10.1');
        expect(describeDay(['j'], '2024-12-06', index, 'tournament')).toBe('Princeton +12.3');
        expect(describeDay(['j', 'l'], '2024-12-06', index, 'any')).toBe(
            'Princeton: Jiayi +12.3, Leon +10.1'
        );
    });

    it('explains flat points for people who sat a tournament out', () => {
        expect(describeDay(['a'], '2024-12-06', index, 'tournament')).toBe(
            "Didn't attend Princeton"
        );
    });

    it('describes practice rounds and starting points', () => {
        expect(describeDay(['l'], '2024-10-01', index, 'plain')).toBe(
            'Practice loss vs Aaditya + ? -8.0'
        );
        expect(describeDay(['a'], '2024-10-01', index, 'plain')).toBe(
            'Practice win vs Jiayi + Leon +14.0'
        );
        expect(describeDay(['a'], '2024-08-01', index, 'plain', true)).toBe('Starting Elo');
        expect(describeDay(['a'], '2024-08-01', index, 'plain')).toBeUndefined();
    });

    it('puts those labels on the chart points', () => {
        const { series } = buildEloSeries({
            debaters: people,
            selectedId: 'l',
            compareId: 'a',
            tournaments: [princeton],
        });
        expect(series[0].data.map((p) => p.event)).toEqual(['Starting Elo', 'Princeton +10.1']);
        expect(series[1].data.map((p) => p.event)).toEqual([
            'Starting Elo',
            "Didn't attend Princeton",
        ]);
    });

    it('labels team points with both partners', () => {
        const teams: Team[] = [
            {
                id: 'jl',
                name: null,
                member1_id: 'j',
                member2_id: 'l',
                division: 'Varsity',
                season: '2024-25',
                active: true,
            },
        ];
        const single = buildEloSeries({
            debaters: people,
            teams,
            selectedId: teamKey('jl'),
            tournaments: [princeton],
        });
        expect(single.series[0].data.map((p) => p.event)).toEqual([
            'Starting Elo',
            'Princeton: Jiayi +12.3, Leon +10.1',
        ]);
        const all = buildEloSeries({ debaters: people, teams, selectedId: ALL_TEAMS, tournaments: [princeton] });
        expect(all.series[0].data[1].event).toBe('Princeton: Jiayi +12.3, Leon +10.1');
    });

    it('keeps the plain labels when no tournaments are passed', () => {
        const { series } = buildEloSeries({ debaters: people, selectedId: 'l' });
        expect(series[0].data.map((p) => p.event)).toEqual([undefined, 'Tournament']);
    });
});
