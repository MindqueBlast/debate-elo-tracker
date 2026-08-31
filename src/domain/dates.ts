const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
    if (!DATE_RE.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return (
        dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    );
}

export function getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar date, never UTC midnight. */
export function parseCalendarDate(value: string): Date | null {
    if (!isCalendarDate(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function formatCalendarDate(
    value: string,
    options?: Intl.DateTimeFormatOptions
): string {
    const date = parseCalendarDate(value);
    if (!date) return value;
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...options,
    });
}

export function compareCalendarDates(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/**
 * Graduation is stored as a year string ("2025") in existing data.
 * Treat that as inclusive through Dec 31 of that year.
 */
export function graduationCutoffDate(graduationDate: string | null): string | null {
    if (!graduationDate) return null;
    if (/^\d{4}$/.test(graduationDate)) {
        return `${graduationDate}-12-31`;
    }
    if (isCalendarDate(graduationDate)) return graduationDate;
    return null;
}

export function isOnOrBefore(date: string, cutoff: string): boolean {
    return date <= cutoff;
}
