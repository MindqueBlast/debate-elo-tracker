import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './Button';
import { Logo } from './Logo';
import { QuickSearch } from './QuickSearch';
import { AppBackground } from './AppBackground';
import { AppCredits } from './AppCredits';
import { useTheme } from '../state/ThemeProvider';

const LINKS = [
    { to: '/app', label: 'Dashboard', end: true },
    { to: '/app/rankings', label: 'Rankings' },
    { to: '/app/matches', label: 'Matches' },
    // only people who can edit see the roster
    { to: '/app/players', label: 'Players', editorsOnly: true },
    { to: '/app/analytics', label: 'Analytics' },
    { to: '/app/matchup', label: 'Matchup' },
];

export function AppShell() {
    const { user, isAdmin, isDev, isGuest, signOut } = useAuth();
    const { pathname } = useLocation();
    const { theme, toggle } = useTheme();
    const [open, setOpen] = useState(false);
    const roleLabel = isAdmin ? 'Admin' : isGuest ? 'Guest' : 'Viewer';
    const extras = (
        <>
            {isDev && <span className="badge">Test mode</span>}
            {isAdmin ? (
                // admins open Settings from their role tag
                <NavLink
                    to="/app/settings"
                    className={({ isActive }) => `pill pill--link${isActive ? ' is-active' : ''}`}
                    title="Settings: who has access"
                    onClick={() => setOpen(false)}
                >
                    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                        <path
                            d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm6 3.6-1.5.3a4.8 4.8 0 0 1-.5 1.2l.9 1.3-1.3 1.3-1.3-.9a4.8 4.8 0 0 1-1.2.5L8.8 14H7.2l-.3-1.5a4.8 4.8 0 0 1-1.2-.5l-1.3.9-1.3-1.3.9-1.3a4.8 4.8 0 0 1-.5-1.2L2 8.8V7.2l1.5-.3c.1-.4.3-.8.5-1.2l-.9-1.3 1.3-1.3 1.3.9c.4-.2.8-.4 1.2-.5L7.2 2h1.6l.3 1.5c.4.1.8.3 1.2.5l1.3-.9 1.3 1.3-.9 1.3c.2.4.4.8.5 1.2L14 7.2Z"
                            fill="currentColor"
                        />
                    </svg>
                    {roleLabel}
                    <span className="sr-only">: settings</span>
                </NavLink>
            ) : (
                <span className="pill">{roleLabel}</span>
            )}
            <Button variant="ghost" size="sm" onClick={(e) => toggle(e.currentTarget)}>
                {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
                {user?.email ? 'Log out' : isGuest ? 'Exit guest' : 'Exit'}
            </Button>
        </>
    );

    return (
        <div className="app-shell">
            <AppBackground variant="app" />
            <a className="skip-link" href="#main">
                Skip to content
            </a>
            <header className="topnav">
                {/* the wordmark goes to the public home page; Dashboard is the first tab */}
                <Link to="/" className="brand" aria-label="Syosset Elo home page">
                    <Logo />
                    <span className="brand-text">Syosset Elo</span>
                </Link>
                <nav
                    className={`nav-links ${open ? 'open' : ''}`}
                    aria-label="Primary"
                >
                    <div className="nav-links__inner">
                        {LINKS.filter((l) => isAdmin || !l.editorsOnly).map((l, i) => (
                            <NavLink
                                key={l.to}
                                to={l.to}
                                end={l.end}
                                // on phones the menu's links drop in one after another
                                style={{ '--n': i } as CSSProperties}
                                className={({ isActive }) =>
                                    `nav-link ${isActive ? 'active' : ''}`
                                }
                                onClick={() => setOpen(false)}
                            >
                                {({ isActive }) => (
                                    <>
                                        {l.label}
                                        {isActive && (
                                            // the scarlet bar slides from the last page's tab to this one
                                            <motion.span
                                                layoutId="nav-bar"
                                                className="nav-link__bar"
                                                transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                                            />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                        {/* on phones the account controls live in the menu */}
                        <div className="nav-links__extra">{extras}</div>
                    </div>
                </nav>
                <div className="nav-actions">
                    <QuickSearch />
                    <div className="nav-actions__extra">{extras}</div>
                    <Button
                        className="mobile-nav-toggle"
                        variant="ghost"
                        size="sm"
                        aria-expanded={open}
                        aria-label="Open menu"
                        onClick={() => setOpen((v) => !v)}
                    >
                        Menu
                    </Button>
                </div>
            </header>
            {/* keyed by page, so each page's title plays its entrance once */}
            <main id="main" className="page" key={pathname}>
                <Outlet />
            </main>
            <AppCredits />
        </div>
    );
}
