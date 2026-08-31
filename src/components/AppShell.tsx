import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './Button';
import { Logo } from './Logo';
import { AppBackground } from './AppBackground';
import { EloCurveMotif } from './illustrations/EloCurveMotif';
import { useTheme } from '../state/ThemeProvider';
import {
    DURATIONS,
    fadeVariants,
    useReducedMotion,
    motionTransition,
} from '../lib/motion';

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
    const location = useLocation();
    const reduced = useReducedMotion();
    const transition = motionTransition(reduced, DURATIONS.fast);

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
                    </div>
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
            <motion.main
                id="main"
                className="page"
                key={location.pathname}
                initial={fadeVariants.initial}
                animate={fadeVariants.animate}
                transition={transition}
            >
                <Outlet />
            </motion.main>
        </div>
    );
}
