import { describe, expect, it } from 'vitest';
import { buildEloSeries } from './chartSeries';
import {
    appendHistory,
    filterHistoryByGraduation,
    filterHistoryByRange,
    hasLaterHistory,
    removeLastMatchingHistoryPoint,
    sanitizeHistory,
    sortHistory,
} from './history';
import { sanitizeDebaters } from './sanitize';
import type { Debater } from './types';

const player = (
    overrides: Partial<Debater> & Pick<Debater, 'id' | 'name'>
): Debater => ({
    elo: 1500,
    status: 'active',
    graduation_date: null,
    history: [],
    ...overrides,
});

describe('history helpers', () => {
    it('drops corrupt points and sorts by date', () => {
        const cleaned = sanitizeHistory([
            { date: '2024-03-02', elo: 1510 },
            { date: 'bad', elo: 12 },
            { date: '2024-03-01', elo: '1500' },
            null,
        ]);
        expect(cleaned.map((p) => p.date)).toEqual(['2024-03-01', '2024-03-02']);
    });

    it('appends and keeps chronological order for backdated points', () => {
        const history = appendHistory(
            [{ date: '2024-03-02', elo: 1510 }],
            { date: '2024-03-01', elo: 1500 }
        );
        expect(sortHistory(history).map((p) => p.date)).toEqual([
            '2024-03-01',
            '2024-03-02',
        ]);
    });

    it('removes only the last matching date/event', () => {
        const history = [
            { date: '2024-03-01', elo: 1500 },
            { date: '2024-03-01', elo: 1510 },
            { date: '2024-03-02', elo: 1520, event: 'Tournament' },
        ];
        const afterPractice = removeLastMatchingHistoryPoint(
            history,
            '2024-03-01'
        );
        expect(afterPractice).toHaveLength(2);
        expect(afterPractice[0].elo).toBe(1500);
        const afterTourney = removeLastMatchingHistoryPoint(
            history,
            '2024-03-02',
            'Tournament'
        );
        expect(afterTourney).toHaveLength(2);
        expect(afterTourney.some((p) => p.event === 'Tournament')).toBe(false);
    });

    it('detects later history after a date', () => {
        expect(
            hasLaterHistory(
                [
                    { date: '2024-01-01', elo: 1500 },
                    { date: '2024-02-01', elo: 1510 },
                ],
                '2024-01-01'
            )
        ).toBe(true);
        expect(
            hasLaterHistory([{ date: '2024-01-01', elo: 1500 }], '2024-01-01')
        ).toBe(false);
    });

    it('filters date ranges inclusively', () => {
        const history = [
            { date: '2024-01-01', elo: 1500 },
            { date: '2024-02-01', elo: 1510 },
            { date: '2024-03-01', elo: 1520 },
        ];
        expect(
            filterHistoryByRange(history, '2024-02-01', '2024-02-28').map(
                (p) => p.date
            )
        ).toEqual(['2024-02-01']);
    });

    it('keeps graduation-year points when cutoff is a year string', () => {
        const history = [
            { date: '2024-12-31', elo: 1500 },
            { date: '2025-06-01', elo: 1600 },
            { date: '2026-01-01', elo: 1700 },
        ];
        expect(
            filterHistoryByGraduation(history, '2025').map((p) => p.date)
        ).toEqual(['2024-12-31', '2025-06-01']);
    });
});

describe('chart series', () => {
    const a = player({
        id: 'a',
        name: 'Ada',
        history: [
            { date: '2024-03-02', elo: 1510 },
            { date: '2024-03-01', elo: 1500 },
        ],
    });
    const b = player({
        id: 'b',
        name: 'Ben',
        history: [{ date: '2024-03-01', elo: 1400 }],
    });

    it('sorts points and supports compare + date range', () => {
        const result = buildEloSeries({
            debaters: [a, b],
            selectedId: 'a',
            compareId: 'b',
            startDate: '2024-03-01',
            endDate: '2024-03-01',
        });
        expect(result.series).toHaveLength(2);
        expect(result.series[0].data.map((p) => p.x)).toEqual(['2024-03-01']);
        expect(result.series[0].id).toBe('a');
        expect(result.isEmpty).toBe(false);
        expect(result.yMin).not.toBe(0);
        expect(result.yMin).toBeLessThan(1400);
    });

    it('does not force y-min to 0 in ALL mode', () => {
        const result = buildEloSeries({
            debaters: [a, b],
            selectedId: 'ALL',
        });
        expect(result.yMin).toBeGreaterThan(1000);
        expect(result.series.every((s) => s.id)).toBe(true);
    });

    it('renders empty state instead of crashing', () => {
        const result = buildEloSeries({
            debaters: [player({ id: 'z', name: 'Empty' })],
            selectedId: 'z',
        });
        expect(result.isEmpty).toBe(true);
        expect(result.series[0].data).toEqual([]);
    });
});

describe('sanitize', () => {
    it('skips corrupt debater records', () => {
        const cleaned = sanitizeDebaters([
            { id: 'a', name: 'Ada', elo: 1500, history: [] },
            { id: 1, name: 'Bad' },
            null,
        ]);
        expect(cleaned).toHaveLength(1);
        expect(cleaned[0].name).toBe('Ada');
    });
});
