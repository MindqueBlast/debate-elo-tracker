import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './Button';
import { Logo } from './Logo';
import { QuickSearch } from './QuickSearch';
import { AppBackground } from './AppBackground';
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
            <span className="pill">{roleLabel}</span>
            <Button variant="ghost" size="sm" onClick={toggle}>
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
                        {LINKS.filter((l) => isAdmin || !l.editorsOnly).map((l) => (
                            <NavLink
                                key={l.to}
                                to={l.to}
                                end={l.end}
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
        </div>
    );
}
