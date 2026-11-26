import { supabase } from '../data/supabase';
import type { UserRole } from './allowlist';

export interface AccessEntry {
    email: string;
    role: UserRole;
    added_by: string | null;
    created_at: string;
}

/** The database's error text, which is written for people ("Wrong password."). */
const message = (err: { message?: string } | null, fallback: string) =>
    err?.message?.trim() || fallback;

/** The role for a signed-in email: admin, viewer, or null for no access. */
export async function fetchRole(email: string | null | undefined): Promise<UserRole | null> {
    if (!email) return null;
    const { data, error } = await supabase.rpc('app_role', { p_email: email });
    if (error) throw new Error(message(error, 'Could not check your access.'));
    return data === 'admin' || data === 'viewer' ? data : null;
}

/** Everyone with access (admins only). */
export async function listAccess(actor: string): Promise<AccessEntry[]> {
    const { data, error } = await supabase.rpc('app_users_list', { p_actor: actor });
    if (error) throw new Error(message(error, 'Could not load who has access.'));
    return (data ?? []) as AccessEntry[];
}

/** Give someone access, or make a viewer an admin. */
export async function addAccess(actor: string, email: string, role: UserRole): Promise<void> {
    const { error } = await supabase.rpc('app_users_add', { p_actor: actor, p_email: email, p_role: role });
    if (error) throw new Error(message(error, 'Could not add them.'));
}

/** Take someone's access away; removing an admin needs the admin password. */
export async function removeAccess(actor: string, email: string, password?: string): Promise<void> {
    const { error } = await supabase.rpc('app_users_remove', {
        p_actor: actor,
        p_email: email,
        p_password: password ?? null,
    });
    if (error) throw new Error(message(error, 'Could not remove them.'));
}
