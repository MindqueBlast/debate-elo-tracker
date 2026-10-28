import { sanitizeHistory } from './history';
import type { Debater } from './types';

export function sanitizeDebater(raw: unknown): Debater | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    if (typeof rec.id !== 'string' || typeof rec.name !== 'string') return null;
    const elo = typeof rec.elo === 'number' ? rec.elo : Number(rec.elo);
    if (!Number.isFinite(elo)) return null;
    const status = rec.status === 'graduated' ? 'graduated' : 'active';
    const graduation_date =
        typeof rec.graduation_date === 'string' ? rec.graduation_date : null;
    const division =
        rec.division === 'Novice' || rec.division === 'JV' || rec.division === 'Varsity'
            ? rec.division
            : null;
    const history = sanitizeHistory(rec.history);
    const startElo = Number(rec.start_elo);
    const created = typeof rec.created_at === 'string' ? rec.created_at : null;
    const startDate =
        typeof rec.start_date === 'string' && rec.start_date
            ? rec.start_date.slice(0, 10)
            : (history[0]?.date ?? (created ? created.slice(0, 10) : '2000-01-01'));
    return {
        id: rec.id,
        name: rec.name,
        elo,
        status,
        graduation_date,
        history,
        division,
        class_year:
            rec.class_year != null && Number.isFinite(Number(rec.class_year))
                ? Number(rec.class_year)
                : null,
        start_elo:
            rec.start_elo != null && Number.isFinite(startElo) ? startElo : (history[0]?.elo ?? elo),
        start_date: startDate,
        created_at: created,
    };
}

export function sanitizeDebaters(raw: unknown): Debater[] {
    if (!Array.isArray(raw)) return [];
    const result: Debater[] = [];
    for (const item of raw) {
        const debater = sanitizeDebater(item);
        if (debater) result.push(debater);
    }
    return result;
}

export function validatePlayerName(
    name: string,
    existing: Debater[],
    exceptId?: string
): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'Please enter a name.';
    if (trimmed.length > 80) return 'Name is too long.';
    const taken = existing.some(
        (d) =>
            d.id !== exceptId &&
            d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (taken) return 'A debater with this name already exists.';
    return null;
}

export function parseEloInput(value: string, fallback = 1500): number | null {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return n;
}
