import { supabase } from './supabase';
import { DEFAULT_CONFIG, parseConfig, type EloConfig } from '../domain';

export interface PublicSettings {
    /** The scoring numbers (Settings → Scoring). */
    elo: EloConfig;
    /** Whether "Browse as guest" is offered. */
    guestAccess: boolean;
}

export const DEFAULT_SETTINGS: PublicSettings = { elo: DEFAULT_CONFIG, guestAccess: true };

/** Settings anyone can read. If they can't load, the defaults are used. */
export async function loadSettings(): Promise<PublicSettings> {
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (error) throw error;
    const byKey = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
    return {
        elo: byKey.has('elo') ? parseConfig(byKey.get('elo')) : DEFAULT_CONFIG,
        guestAccess: byKey.get('guest_access') !== false,
    };
}

let cached: Promise<PublicSettings> | null = null;

/** Loaded once per visit (the landing page and sign-in ask before the app's data loads). */
export function publicSettings(fresh = false): Promise<PublicSettings> {
    if (!cached || fresh) cached = loadSettings().catch(() => DEFAULT_SETTINGS);
    return cached;
}
