import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { roleForEmail, type UserRole } from './allowlist';
import { signInWithGoogle, signOutUser, subscribeAuth } from './firebase';

interface AuthContextValue {
    user: User | null;
    role: UserRole | null;
    loading: boolean;
    error: string | null;
    isAdmin: boolean;
    isDev: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    enterDevMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [devMode, setDevMode] = useState(false);

    useEffect(() => {
        const unsub = subscribeAuth(async (next) => {
            setError(null);
            if (!next) {
                setUser(null);
                setRole(devMode ? 'admin' : null);
                setLoading(false);
                return;
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
    }, [devMode]);

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            role: devMode ? 'admin' : role,
            loading,
            error,
            isAdmin: (devMode ? 'admin' : role) === 'admin',
            isDev: devMode,
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
                await signOutUser();
            },
            enterDevMode: () => {
                setDevMode(true);
                setRole('admin');
                setLoading(false);
            },
        }),
        [user, role, loading, error, devMode]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
