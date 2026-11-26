import { describe, expect, it } from 'vitest';
import { atPersonalBest, eloBefore, seasonBreakdown, seasonMovers, winChance } from './insights';
import type { Debater } from './types';

const person = (id: string, elo: number, history: { date: string; elo: number }[], start_elo = 400): Debater => ({
    id,
    name: id,
    elo,
    status: 'active',
    graduation_date: null,
    history,
    start_elo,
    start_date: '2023-08-01',
});

describe('insights', () => {
    it('reads win chances the standard Elo way', () => {
        expect(winChance(1000, 1000)).toBeCloseTo(0.5, 10);
        expect(winChance(1400, 1000)).toBeCloseTo(10 / 11, 10);
        expect(winChance(1000, 1400)).toBeCloseTo(1 / 11, 10);
    });

    it('finds the rating going into a day', () => {
        const h = [
            { date: '2025-10-01', elo: 500 },
            { date: '2026-03-01', elo: 620 },
            { date: '2026-10-01', elo: 700 },
        ];
        expect(eloBefore(h, 400, '2025-09-01')).toBe(400);
        expect(eloBefore(h, 400, '2026-07-01')).toBe(620);
        // a result on the day itself counts after the day starts
        expect(eloBefore(h, 400, '2026-10-01')).toBe(620);
    });

    it('ranks this season’s movers from where each started the season', () => {
        const a = person('a', 900, [{ date: '2026-03-01', elo: 800 }, { date: '2026-10-01', elo: 900 }]);
        const b = person('b', 650, [{ date: '2026-03-01', elo: 700 }, { date: '2026-10-01', elo: 650 }]);
        const fresh = person('c', 520, [{ date: '2026-10-01', elo: 520 }]);
        const movers = seasonMovers([a, b, fresh], new Set(['a', 'b', 'c']), '2026-27');
        // c joined this season at 400; a began it at 800; b at 700
        expect(movers.map((m) => [m.id, m.change])).toEqual([
            ['c', 120],
            ['a', 100],
            ['b', -50],
        ]);
        expect(movers.find((m) => m.id === 'c')!.from).toBe(400);
    });

    it('lists people at their best today', () => {
        const top = person('top', 900, [{ date: '2026-01-01', elo: 800 }, { date: '2026-10-01', elo: 900 }]);
        const fell = person('fell', 800, [{ date: '2026-01-01', elo: 850 }, { date: '2026-10-01', elo: 800 }]);
        const none = person('none', 400, []);
        expect(atPersonalBest([top, fell, none], new Set(['top', 'fell', 'none'])).map((d) => d.id)).toEqual(['top']);
    });

    it('breaks a career into seasons, newest first', () => {
        const h = [
            { date: '2025-10-01', elo: 480 },
            { date: '2026-02-01', elo: 560 },
            { date: '2026-10-01', elo: 600 },
            { date: '2026-11-01', elo: 590 },
        ];
        const results = [
            { date: '2025-10-01', name: 'Fall', change: 80 },
            { date: '2026-02-01', name: 'Spring', change: 80.5 },
            { date: '2026-10-01', name: 'Yale', change: 40 },
            { date: '2026-11-01', name: 'Local', change: -10 },
        ];
        const rows = seasonBreakdown(h, 400, results);
        expect(rows.map((r) => r.season)).toEqual(['2026-27', '2025-26']);
        expect(rows[1]).toMatchObject({ start: 400, end: 560, change: 160, peak: 560, tournaments: 2, best: { name: 'Spring', change: 80.5 } });
        expect(rows[0]).toMatchObject({ start: 560, end: 590, change: 30, peak: 600, tournaments: 2, best: { name: 'Yale', change: 40 } });
    });
});
