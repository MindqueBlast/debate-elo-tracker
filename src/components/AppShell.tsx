import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './Button';
import { Logo } from './Logo';
import { useTheme } from '../state/ThemeProvider';

const LINKS = [
    { to: '/app', label: 'Dashboard', end: true },
    { to: '/app/rankings', label: 'Rankings' },
    { to: '/app/matches', label: 'Matches' },
    { to: '/app/players', label: 'Players' },
    { to: '/app/analytics', label: 'Analytics' },
];

export function AppShell() {
    const { user, isAdmin, isDev, signOut } = useAuth();
    const { theme, toggle } = useTheme();
    const [open, setOpen] = useState(false);

    return (
        <div className="app-shell">
            <div className="app-bg" aria-hidden="true" />
            <a className="skip-link" href="#main">
                Skip to content
            </a>
            <header className="topnav">
                <NavLink to="/app" className="brand">
                    <Logo />
                    Syosset Elo
                </NavLink>
                <nav
                    className={`nav-links ${open ? 'open' : ''}`}
                    aria-label="Primary"
                >
                    {LINKS.map((l) => (
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
                </nav>
                <div className="nav-actions">
                    {isDev && <span className="badge">Test mode</span>}
                    <span className="pill">{isAdmin ? 'Admin' : 'Viewer'}</span>
                    <Button variant="ghost" size="sm" onClick={toggle}>
                        {theme === 'dark' ? 'Light' : 'Dark'}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void signOut()}
                    >
                        {user?.email ? 'Log out' : 'Exit'}
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
            <main id="main" className="page page-enter">
                <Outlet />
            </main>
        </div>
    );
}
