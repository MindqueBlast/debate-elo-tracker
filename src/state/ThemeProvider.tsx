import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{
    theme: Theme;
    /** Pass the button that was pressed, and the new theme spreads out from it. */
    toggle: (from?: Element | null) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem('det-theme');
        return stored === 'light' ? 'light' : 'dark';
    });
    const themeRef = useRef(theme);
    themeRef.current = theme;

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('det-theme', theme);
    }, [theme]);

    const toggle = useCallback((from?: Element | null) => {
        const next: Theme = themeRef.current === 'dark' ? 'light' : 'dark';
        const apply = () => {
            document.documentElement.dataset.theme = next;
            flushSync(() => setTheme(next));
        };
        const root = document.documentElement;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || !('startViewTransition' in document)) {
            apply();
            return;
        }
        // the new theme opens as a circle from the button that was pressed
        const box = from?.getBoundingClientRect();
        const x = box ? box.left + box.width / 2 : window.innerWidth - 48;
        const y = box ? box.top + box.height / 2 : 32;
        const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        root.style.setProperty('--wipe-x', `${x}px`);
        root.style.setProperty('--wipe-y', `${y}px`);
        root.style.setProperty('--wipe-r', `${Math.ceil(r)}px`);
        root.classList.add('vt-theme');
        const t = document.startViewTransition(apply);
        void t.finished.finally(() => root.classList.remove('vt-theme'));
    }, []);

    const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
