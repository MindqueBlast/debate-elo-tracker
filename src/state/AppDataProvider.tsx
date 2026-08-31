import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { loadSnapshot, type AppSnapshot } from '../data/loaders';

interface AppDataContextValue extends AppSnapshot {
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const EMPTY: AppSnapshot = {
    debaters: [],
    practiceRounds: [],
    tournaments: [],
    annotations: [],
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({
    enabled,
    children,
}: {
    enabled: boolean;
    children: React.ReactNode;
}) {
    const [data, setData] = useState<AppSnapshot>(EMPTY);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);
    const gen = useRef(0);

    const refresh = useCallback(async () => {
        const id = ++gen.current;
        setLoading(true);
        setError(null);
        try {
            const snapshot = await loadSnapshot();
            if (id !== gen.current) return;
            setData(snapshot);
        } catch (err) {
            if (id !== gen.current) return;
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not load data from the database.'
            );
        } finally {
            if (id === gen.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        void refresh();
    }, [enabled, refresh]);

    const value = useMemo(
        () => ({ ...data, loading, error, refresh }),
        [data, loading, error, refresh]
    );

    return (
        <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
    );
}

export function useAppData() {
    const ctx = useContext(AppDataContext);
    if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
    return ctx;
}
