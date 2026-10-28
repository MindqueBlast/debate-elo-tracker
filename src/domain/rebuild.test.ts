import { describe, expect, it } from 'vitest';
import { calculateTournamentElo } from './elo';
import {
    computeAll,
    diffDerived,
    isEmptyDerived,
    withoutPerson,
    type InputEntry,
    type InputPerson,
    type Inputs,
    type InputTournament,
} from './rebuild';

const person = (id: string, start_elo: number, extra: Partial<InputPerson> = {}): InputPerson => ({
    id,
    name: id,
    division: 'Varsity',
    status: 'active',
    graduation_date: null,
    class_year: 2027,
    start_elo,
    start_date: '2024-08-01',
    ...extra,
});

const entry = (
    id: string,
    a: string,
    b: string | null,
    raw: number,
    division: InputEntry['division'] = 'Varsity'
): InputEntry => ({
    id,
    debater_id: a,
    partner_id: b,
    team_id: null,
    division,
    raw_wins: raw,
    rounds: 6,
});

const tourney = (
    id: string,
    date: string,
    entries: InputEntry[],
    extra: Partial<InputTournament> = {}
): InputTournament => ({
    id,
    date,
    name: id,
    bonus: 30,
    affect: 45,
    max_gain: 300,
    max_rounds: null,
    entries,
    ...extra,
});

const TODAY = '2024-12-01';

const base = (): Inputs => ({
    people: [person('j', 1000), person('l', 950), person('a', 900), person('c', 880), person('x', 800)],
    tournaments: [
        tourney('t1', '2024-10-05', [entry('e1', 'j', 'l', 5), entry('e2', 'a', 'c', 3)]),
        tourney('t2', '2024-11-02', [entry('e3', 'j', 'l', 4), entry('e4', 'a', 'c', 4)]),
    ],
    practice: [],
    adjustments: [],
});

const editEntry = (inputs: Inputs, id: string, patch: Partial<InputEntry>): Inputs => ({
    ...inputs,
    tournaments: inputs.tournaments.map((t) => ({
        ...t,
        entries: t.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),
});

describe('recalculating everything from the facts', () => {
    it('gives the same numbers as the tournament math', () => {
        const d = computeAll(base(), TODAY);
        const { results, eTourney } = calculateTournamentElo(
            [
                {
                    id: 'e1',
                    name: 'e1',
                    elo: 975,
                    members: [
                        { id: 'j', elo: 1000 },
                        { id: 'l', elo: 950 },
                    ],
                    division: 'Varsity',
                    W_raw: 5,
                    n: 6,
                },
                {
                    id: 'e2',
                    name: 'e2',
                    elo: 890,
                    members: [
                        { id: 'a', elo: 900 },
                        { id: 'c', elo: 880 },
                    ],
                    division: 'Varsity',
                    W_raw: 3,
                    n: 6,
                },
            ],
            { n: 6, b: 30, k: 45, maxGain: 300, maxRounds: null }
        );
        expect(d.tournaments.t1.e_tourney).toBeCloseTo(eTourney, 12);
        expect(d.entries.e1.elo_change).toBeCloseTo(results[0].members[0].change, 12);
        expect(d.entries.e1.partner_elo_change).toBeCloseTo(results[0].members[1].change, 12);
        expect(d.entries.e1.team_elo).toBe(975);
    });

    it('carries a fix to an old result through everything after it', () => {
        const before = computeAll(base(), TODAY);
        const after = computeAll(editEntry(base(), 'e1', { raw_wins: 2 }), TODAY);
        // the edited result and the same people's next tournament both change
        expect(after.entries.e1.elo_change).not.toBeCloseTo(before.entries.e1.elo_change, 6);
        expect(after.entries.e3.elo_change).not.toBeCloseTo(before.entries.e3.elo_change, 6);
        expect(after.people.j.elo).toBeLessThan(before.people.j.elo);
        // the tournament's expected score moved, so the other pair's result there moves too,
        // and that carries into their next tournament
        expect(after.tournaments.t1.e_tourney).toBeLessThan(before.tournaments.t1.e_tourney);
        expect(after.entries.e2.elo_change).toBeGreaterThan(before.entries.e2.elo_change);
        expect(after.entries.e4.elo_change).not.toBeCloseTo(before.entries.e4.elo_change, 6);
        // nothing before the fixed tournament moves
        expect(after.people.x.history).toEqual(before.people.x.history);
        // and putting the old number back restores everything exactly
        expect(isEmptyDerived(diffDerived(computeAll(base(), TODAY), before))).toBe(true);
    });

    it("doesn't depend on the order results were loaded in", () => {
        const shuffled = { ...base(), tournaments: [...base().tournaments].reverse() };
        expect(isEmptyDerived(diffDerived(computeAll(shuffled, TODAY), computeAll(base(), TODAY)))).toBe(
            true
        );
    });

    it('gives a flat point to people on the team who skip a tournament', () => {
        const d = computeAll(base(), TODAY);
        expect(d.people.x.history).toEqual([
            { date: '2024-08-01', elo: 800 },
            { date: '2024-10-05', elo: 800, event: 'Tournament' },
            { date: '2024-11-02', elo: 800, event: 'Tournament' },
        ]);
    });

    it('stops the flat points after someone graduates', () => {
        const inputs = base();
        inputs.people.push(
            person('g', 700, { status: 'graduated', graduation_date: '2024-06-30', start_date: '2023-08-01' })
        );
        const d = computeAll(inputs, TODAY);
        expect(d.people.g.history).toEqual([{ date: '2023-08-01', elo: 700 }]);
    });

    it('starts someone earlier when a result is dated before their start', () => {
        const inputs = base();
        inputs.people.push(person('y', 400, { start_date: '2024-11-20' }));
        inputs.tournaments[0].entries.push(entry('e5', 'y', null, 2, 'Novice'));
        const d = computeAll(inputs, TODAY);
        expect(d.people.y.history[0]).toEqual({ date: '2024-10-05', elo: 400 });
        expect(d.people.y.history[1].event).toBe('Tournament');
    });

    it('keeps manual adjustments on their day and carries them forward', () => {
        const plain = computeAll(base(), TODAY);
        const inputs = base();
        inputs.adjustments.push({
            id: 'adj',
            debater_id: 'j',
            date: '2024-10-20',
            amount: 20,
            note: 'typo fix',
        });
        const d = computeAll(inputs, TODAY);
        const point = d.people.j.history.find((h) => h.date === '2024-10-20');
        const afterT1 = plain.people.j.history.find((h) => h.date === '2024-10-05')!.elo;
        expect(point).toEqual({
            date: '2024-10-20',
            elo: afterT1 + 20,
            event: 'Manual adjustment +20.0 (typo fix)',
        });
        expect(d.people.j.elo).not.toBeCloseTo(plain.people.j.elo + 20, 6); // t2 scored from the higher Elo
    });

    it('scores practice rounds in date order with tournaments', () => {
        const inputs = base();
        inputs.practice.push({
            id: 'p1',
            date: '2024-10-05',
            winner_id: 'a',
            winner_partner_id: 'c',
            loser_id: 'j',
            loser_partner_id: 'l',
        });
        const d = computeAll(inputs, TODAY);
        expect(d.practice.p1.winner_change).toBeGreaterThan(0);
        expect(d.practice.p1.loser_partner_change).toBeLessThan(0);
        // the round comes before that day's tournament, so t1 starts from the new Elo
        expect(d.entries.e1.team_elo).toBeCloseTo(
            975 + (d.practice.p1.loser_change + (d.practice.p1.loser_partner_change ?? 0)) / 2,
            9
        );
    });
});

describe('taking someone out', () => {
    it('leaves their partner with the result and drops results that were only them', () => {
        const inputs = base();
        inputs.tournaments.push(tourney('t3', '2024-11-09', [entry('e6', 'x', null, 3)]));
        const w = withoutPerson(inputs, 'l');
        expect(w.changedEntries.map((c) => c.entry)).toEqual([
            { ...entry('e1', 'j', null, 5) },
            { ...entry('e3', 'j', null, 4) },
        ]);
        expect(w.deletedEntryIds).toEqual([]);
        expect(w.inputs.people.map((p) => p.id)).not.toContain('l');

        const wx = withoutPerson(inputs, 'x');
        expect(wx.deletedEntryIds).toEqual(['e6']);
        expect(wx.deletedTournamentIds).toEqual(['t3']);
        expect(wx.inputs.tournaments.map((t) => t.id)).toEqual(['t1', 't2']);
    });

    it("scores the partner on their own, so their numbers don't change", () => {
        const before = computeAll(base(), TODAY);
        const after = computeAll(withoutPerson(base(), 'l').inputs, TODAY);
        expect(after.entries.e1.elo_change).toBeCloseTo(before.entries.e1.elo_change, 12);
        expect(after.entries.e1.partner_elo_change).toBeNull();
        expect(after.people.j.elo).toBeCloseTo(before.people.j.elo, 12);
    });
});
