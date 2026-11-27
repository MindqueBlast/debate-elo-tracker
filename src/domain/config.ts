import type { Division } from './types';

/**
 * The numbers the Elo math runs on, as admins set them in Settings → Scoring.
 *
 * Some apply straight to the math (division bars, phantom teams, practice
 * K). Others are stored on each record when it's saved (a tournament's K and
 * bonus, a person's starting Elo), so changing them here also rewrites the
 * records that used the old value; see scoringRewrite.
 */
export interface EloConfig {
    /** How far one tournament can move someone (stored on each tournament as its K). */
    k: number;
    /** The bonus each type of tournament adds (stored on each tournament). */
    bonuses: Record<TournamentType, number>;
    /** What each division's results are measured against: p = (Elo / bar)^1.5. */
    bars: Record<Division, number>;
    /** Imaginary .500 teams added to every tournament's average, so a small field doesn't swing it. */
    phantoms: number;
    /** Where someone new starts, by the division they first debate in. */
    startElo: Record<Division, number>;
    /** Practice rounds: K for the result itself. */
    practiceK: number;
    /** Practice rounds: a little for showing up, win or lose. */
    practiceBonus: number;
}

export type TournamentType = 'invitational' | 'local' | 'citron';

export const TOURNAMENT_TYPES: { id: TournamentType; name: string; label: string }[] = [
    { id: 'invitational', name: 'Invitational', label: 'Invitational (5–6+ rounds)' },
    { id: 'local', name: 'Local', label: 'Local / NYSFL / NCFL / NSDA elims' },
    { id: 'citron', name: 'Citron', label: 'Citron / BDL' },
];

export const DEFAULT_CONFIG: EloConfig = {
    k: 45,
    bonuses: { invitational: 30, local: 15, citron: 10 },
    bars: { Novice: 550, JV: 700, Varsity: 850 },
    phantoms: 3,
    startElo: { Novice: 400, JV: 600, Varsity: 800 },
    practiceK: 20,
    practiceBonus: 5,
};

let current: EloConfig = DEFAULT_CONFIG;

/** The settings the math is using right now. */
export function getEloConfig(): EloConfig {
    return current;
}

export function setEloConfig(config: EloConfig) {
    current = config;
}

/** Run something under other settings (e.g. to preview them), then put the real ones back. */
export function withEloConfig<T>(config: EloConfig, run: () => T): T {
    const saved = current;
    current = config;
    try {
        return run();
    } finally {
        current = saved;
    }
}

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

const byDivision = (raw: unknown, fallback: Record<Division, number>, min: number): Record<Division, number> => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
        Novice: num(r.Novice, fallback.Novice, min),
        JV: num(r.JV, fallback.JV, min),
        Varsity: num(r.Varsity, fallback.Varsity, min),
    };
};

/** Settings as saved in the database; anything missing or unusable falls back to the defaults. */
export function parseConfig(raw: unknown): EloConfig {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const b = (r.bonuses && typeof r.bonuses === 'object' ? r.bonuses : {}) as Record<string, unknown>;
    const d = DEFAULT_CONFIG;
    return {
        k: num(r.k, d.k, 0),
        bonuses: {
            invitational: num(b.invitational, d.bonuses.invitational),
            local: num(b.local, d.bonuses.local),
            citron: num(b.citron, d.bonuses.citron),
        },
        bars: byDivision(r.bars, d.bars, 1),
        phantoms: Math.round(num(r.phantoms, d.phantoms, 0, 50)),
        startElo: byDivision(r.startElo, d.startElo, 0),
        practiceK: num(r.practiceK, d.practiceK, 0),
        practiceBonus: num(r.practiceBonus, d.practiceBonus, 0),
    };
}

/** What's wrong with a set of settings, or null if they can be saved. */
export function validateConfig(c: EloConfig): string | null {
    const all = [
        c.k,
        ...Object.values(c.bonuses),
        ...Object.values(c.bars),
        c.phantoms,
        ...Object.values(c.startElo),
        c.practiceK,
        c.practiceBonus,
    ];
    if (all.some((n) => !Number.isFinite(n))) return 'Every box needs a number.';
    if (c.k <= 0) return 'K has to be more than 0.';
    if (Object.values(c.bars).some((n) => n <= 0)) return 'Division bars have to be more than 0.';
    if (c.phantoms < 0 || !Number.isInteger(c.phantoms)) return 'Phantom teams has to be a whole number, 0 or more.';
    if (Object.values(c.startElo).some((n) => n < 0)) return 'Starting Elo can’t be negative.';
    if (c.practiceK < 0 || c.practiceBonus < 0) return 'Practice numbers can’t be negative.';
    const bonuses = Object.values(c.bonuses);
    // a tournament's type is read from its bonus, so two types can't share one
    if (new Set(bonuses).size !== bonuses.length) return 'Each type of tournament needs its own bonus.';
    return null;
}

export function sameConfig(a: EloConfig, b: EloConfig): boolean {
    return JSON.stringify(parseConfig(a)) === JSON.stringify(parseConfig(b));
}

/** The type a stored bonus stands for, under these settings (null: a custom bonus). */
export function typeOfBonus(bonus: number | null | undefined, config: EloConfig = current): TournamentType | null {
    if (bonus == null) return null;
    return TOURNAMENT_TYPES.find((t) => config.bonuses[t.id] === bonus)?.id ?? null;
}

/** "Invitational", or "Bonus 12" for a custom one. */
export function typeName(bonus: number | null | undefined, config: EloConfig = current): string {
    const t = typeOfBonus(bonus, config);
    if (t) return TOURNAMENT_TYPES.find((x) => x.id === t)!.name;
    return bonus != null ? `Bonus ${bonus}` : 'Tournament';
}
