import { describe, expect, it } from 'vitest';
import { formatCalendarDate, parseCalendarDate } from './dates';

describe('calendar dates', () => {
    it('parses YYYY-MM-DD as a local date, not UTC midnight', () => {
        const date = parseCalendarDate('2024-06-15');
        expect(date).not.toBeNull();
        expect(date!.getFullYear()).toBe(2024);
        expect(date!.getMonth()).toBe(5);
        expect(date!.getDate()).toBe(15);
    });

    it('formats without shifting a day in typical US timezones', () => {
        expect(formatCalendarDate('2024-06-15')).toMatch(/Jun.*15.*2024/);
    });
});
