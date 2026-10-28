import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { roleForEmail, type UserRole } from './allowlist';
import { signInWithGoogle, signOutUser, subscribeAuth } from './firebase';

const GUEST_KEY = 'det-guest';

interface AuthContextValue {
    user: User | null;
    role: UserRole | null;
    loading: boolean;
    error: string | null;
    isAdmin: boolean;
    isDev: boolean;
    isGuest: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    enterGuestMode: () => void;
    enterDevMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readGuestFlag() {
    try {
        return localStorage.getItem(GUEST_KEY) === '1';
    } catch {
        return false;
    }
}

function writeGuestFlag(on: boolean) {
    try {
        if (on) localStorage.setItem(GUEST_KEY, '1');
        else localStorage.removeItem(GUEST_KEY);
    } catch {
        /* ignore */
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [devMode, setDevMode] = useState(false);
    const [guestMode, setGuestMode] = useState(readGuestFlag);

    useEffect(() => {
        const unsub = subscribeAuth(async (next) => {
            setError(null);
            if (!next) {
                setUser(null);
                if (devMode) {
                    setRole('admin');
                } else if (guestMode) {
                    setRole('viewer');
                } else {
                    setRole(null);
                }
                setLoading(false);
                return;
            }
            // Signed-in Google users replace guest mode.
            if (guestMode) {
                setGuestMode(false);
                writeGuestFlag(false);
            }
            const nextRole = roleForEmail(next.email);
            if (!nextRole) {
                setError('Access denied. Your account is not authorized.');
                await signOutUser();
                setUser(null);
                setRole(null);
                setLoading(false);
                return;
            }
            setUser(next);
            setRole(nextRole);
            setLoading(false);
        });
        return unsub;
    }, [devMode, guestMode]);

    const effectiveRole: UserRole | null = devMode
        ? 'admin'
        : guestMode && !user
          ? 'viewer'
          : role;

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            role: effectiveRole,
            loading,
            error,
            isAdmin: effectiveRole === 'admin',
            isDev: devMode,
            isGuest: guestMode && !user && !devMode,
            signIn: async () => {
                setError(null);
                try {
                    await signInWithGoogle();
                } catch (err) {
                    setError(
                        err instanceof Error ? err.message : 'Login failed.'
                    );
                }
            },
            signOut: async () => {
                setDevMode(false);
                setGuestMode(false);
                writeGuestFlag(false);
                setRole(null);
                await signOutUser();
            },
            enterGuestMode: () => {
                setError(null);
                setDevMode(false);
                setGuestMode(true);
                writeGuestFlag(true);
                setRole('viewer');
                setLoading(false);
            },
            enterDevMode: () => {
                setGuestMode(false);
                writeGuestFlag(false);
                setDevMode(true);
                setRole('admin');
                setLoading(false);
            },
        }),
        [user, effectiveRole, loading, error, devMode, guestMode]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
