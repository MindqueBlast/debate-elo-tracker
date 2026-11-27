/** The admin-only lists and backups (each call is checked against the access list). */
import { supabase } from './supabase';
import type { LoggedChange } from './mutations';

export interface BackupInfo {
    id: string;
    created_at: string;
    actor: string | null;
    reason: string;
    people: number;
    tournaments: number;
    practice: number;
    bytes: number;
}

const fail = (err: { message?: string } | null, fallback: string) => new Error(err?.message?.trim() || fallback);

export async function listChanges(actor: string, limit = 80): Promise<LoggedChange[]> {
    const { data, error } = await supabase.rpc('change_log_list', { p_actor: actor, p_limit: limit });
    if (error) throw fail(error, 'Could not load the change log.');
    return (data ?? []) as LoggedChange[];
}

export async function listBackups(actor: string): Promise<BackupInfo[]> {
    const { data, error } = await supabase.rpc('backups_list', { p_actor: actor });
    if (error) throw fail(error, 'Could not load the backups.');
    return (data ?? []) as BackupInfo[];
}

export async function createBackup(actor: string, reason?: string): Promise<string> {
    const { data, error } = await supabase.rpc('backup_create', { p_actor: actor, p_reason: reason ?? null });
    if (error) throw fail(error, 'Could not take a backup.');
    return data as string;
}

/** Every table as a backup has it. */
export async function getBackup(actor: string, id: string): Promise<Record<string, unknown[]>> {
    const { data, error } = await supabase.rpc('backup_get', { p_actor: actor, p_id: id });
    if (error) throw fail(error, 'Could not load that backup.');
    return data as Record<string, unknown[]>;
}

export async function restoreBackup(actor: string, password: string, id: string): Promise<void> {
    const { error } = await supabase.rpc('backup_restore', { p_actor: actor, p_password: password, p_id: id });
    if (error) throw fail(error, 'Could not restore that backup.');
}

export async function setGuestAccess(actor: string, on: boolean): Promise<void> {
    const { error } = await supabase.rpc('settings_set', { p_actor: actor, p_key: 'guest_access', p_value: on });
    if (error) throw fail(error, 'Could not change that.');
}
