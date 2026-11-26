import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { rankTeams } from '../domain';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../state/AppDataProvider';

interface Item {
    key: string;
    label: string;
    kind: string;
    detail?: string;
    to: string;
}

const PAGES: (Item & { editorsOnly?: boolean })[] = [
    { key: 'p-dash', label: 'Dashboard', kind: 'Page', to: '/app' },
    { key: 'p-rank', label: 'Rankings', kind: 'Page', to: '/app/rankings' },
    { key: 'p-match', label: 'Matches', kind: 'Page', to: '/app/matches' },
    { key: 'p-players', label: 'Players', kind: 'Page', to: '/app/players', editorsOnly: true },
    { key: 'p-analytics', label: 'Analytics', kind: 'Page', to: '/app/analytics' },
    { key: 'p-matchup', label: 'Matchup', kind: 'Page', to: '/app/matchup' },
    { key: 'p-settings', label: 'Settings', kind: 'Page', to: '/app/settings', editorsOnly: true },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Jump anywhere: Ctrl+K (⌘K on a Mac), or the Search button, opens a box that
 * finds pages, debaters (to their profile) and teams (to a matchup).
 */
export function QuickSearch() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const { debaters, teams } = useAppData();
    const inputRef = useRef<HTMLInputElement>(null);
    const returnTo = useRef<HTMLElement | null>(null);
    const listId = useId();

    const show = () => {
        returnTo.current = document.activeElement as HTMLElement | null;
        setQ('');
        setActive(0);
        setOpen(true);
    };
    const hide = () => {
        setOpen(false);
        returnTo.current?.focus?.();
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (open) hide();
                else show();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const items = useMemo<Item[]>(() => {
        const people = [...debaters]
            .sort((a, b) => Number(a.status === 'graduated') - Number(b.status === 'graduated') || b.elo - a.elo)
            .map((d) => ({
                key: `d-${d.id}`,
                label: d.name,
                kind: d.status === 'graduated' ? 'Graduate' : 'Debater',
                detail: `${Math.round(d.elo)}`,
                to: `/app/players/${d.id}`,
            }));
        const pairs = rankTeams(teams, debaters).map((t) => ({
            key: `t-${t.team.id}`,
            label: t.name,
            kind: 'Team',
            detail: `${Math.round(t.elo)}`,
            to: `/app/matchup?a=team:${t.team.id}`,
        }));
        const pages = PAGES.filter((p) => isAdmin || !p.editorsOnly);
        const needle = q.trim().toLowerCase();
        if (!needle) return [...pages, ...people.slice(0, 5)];
        const score = (label: string) => {
            const l = label.toLowerCase();
            return l.startsWith(needle) ? 0 : l.split(/[\s+]/).some((w) => w.startsWith(needle)) ? 1 : l.includes(needle) ? 2 : 3;
        };
        return [...pages, ...people, ...pairs]
            .map((it) => ({ it, s: score(it.label) }))
            .filter((x) => x.s < 3)
            .sort((a, b) => a.s - b.s)
            .slice(0, 9)
            .map((x) => x.it);
    }, [q, debaters, teams, isAdmin]);

    const go = (it: Item | undefined) => {
        if (!it) return;
        setOpen(false);
        navigate(it.to);
    };

    return (
        <>
            <button type="button" className="qs-trigger" onClick={show} aria-label="Search (Ctrl K)">
                <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                <span className="qs-trigger__label">Search</span>
                <kbd className="qs-trigger__kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
            {/* the box lives on the page body, not inside the black scoreboard bar */}
            {open &&
                createPortal(
                <div className="qs-backdrop" onMouseDown={(e) => e.target === e.currentTarget && hide()}>
                    <div className="qs" role="dialog" aria-modal="true" aria-label="Search the tracker">
                        <input
                            ref={inputRef}
                            className="qs__input"
                            placeholder="Find a debater, team or page"
                            role="combobox"
                            aria-expanded="true"
                            aria-controls={listId}
                            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
                            value={q}
                            onChange={(e) => {
                                setQ(e.target.value);
                                setActive(0);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setActive((i) => Math.min(i + 1, items.length - 1));
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setActive((i) => Math.max(i - 1, 0));
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    go(items[active]);
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    hide();
                                } else if (e.key === 'Tab') {
                                    // keep focus in the box while it's open
                                    e.preventDefault();
                                }
                            }}
                        />
                        <ul className="qs__list" id={listId} role="listbox" aria-label="Results">
                            {items.length === 0 ? (
                                <li className="qs__empty">Nothing by that name.</li>
                            ) : (
                                items.map((it, i) => (
                                    <li
                                        key={it.key}
                                        id={`${listId}-${i}`}
                                        role="option"
                                        aria-selected={i === active}
                                        className={`qs__item${i === active ? ' is-active' : ''}`}
                                        onMouseEnter={() => setActive(i)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => go(it)}
                                    >
                                        <span className="qs__label">{it.label}</span>
                                        {it.detail && <span className="qs__detail figure">{it.detail}</span>}
                                        <span className="qs__kind">{it.kind}</span>
                                    </li>
                                ))
                            )}
                        </ul>
                        <p className="qs__hint">
                            <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close
                        </p>
                    </div>
                </div>,
                    document.body
                )}
        </>
    );
}
