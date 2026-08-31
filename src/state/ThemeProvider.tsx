import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{
    theme: Theme;
    toggle: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem('det-theme');
        return stored === 'light' ? 'light' : 'dark';
    });

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('det-theme', theme);
    }, [theme]);

    const value = useMemo(
        () => ({
            theme,
            toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
        }),
        [theme]
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
