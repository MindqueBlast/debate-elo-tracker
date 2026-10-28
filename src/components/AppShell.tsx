import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './Button';
import { Logo } from './Logo';
import { AppBackground } from './AppBackground';
import { EloCurveMotif } from './illustrations/EloCurveMotif';
import { useTheme } from '../state/ThemeProvider';

const LINKS = [
    { to: '/app', label: 'Dashboard', end: true },
    { to: '/app/rankings', label: 'Rankings' },
    { to: '/app/matches', label: 'Matches' },
    // only people who can edit see the roster
    { to: '/app/players', label: 'Players', editorsOnly: true },
    { to: '/app/analytics', label: 'Analytics' },
];

export function AppShell() {
    const { user, isAdmin, isDev, isGuest, signOut } = useAuth();
    const { theme, toggle } = useTheme();
    const [open, setOpen] = useState(false);
    const roleLabel = isAdmin ? 'Admin' : isGuest ? 'Guest' : 'Viewer';

    return (
        <div className="app-shell">
            <AppBackground variant="app" />
            <a className="skip-link" href="#main">
                Skip to content
            </a>
            <header className="topnav">
                <NavLink to="/app" className="brand">
                    <Logo />
                    <span className="brand-text">Syosset Elo</span>
                    <EloCurveMotif size={32} tone="muted" className="brand-motif" />
                </NavLink>
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
                                {l.label}
                            </NavLink>
                        ))}
                    </div>
                </nav>
                <div className="nav-actions">
                    {isDev && <span className="badge">Test mode</span>}
                    <span className="pill">{roleLabel}</span>
                    <Button variant="ghost" size="sm" onClick={toggle}>
                        {theme === 'dark' ? 'Light' : 'Dark'}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void signOut()}
                    >
                        {user?.email ? 'Log out' : isGuest ? 'Exit guest' : 'Exit'}
                    </Button>
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
            <main id="main" className="page">
                <Outlet />
            </main>
        </div>
    );
}
