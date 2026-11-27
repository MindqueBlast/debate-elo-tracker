import { useAuth } from './AuthProvider';

/**
 * The signed-in admin's email, which admin-only actions are checked against.
 * In test mode on a dev machine, VITE_DEV_EMAIL stands in.
 */
export function useActor(): string | null {
    const { user } = useAuth();
    return user?.email ?? (import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL ?? null) : null);
}
