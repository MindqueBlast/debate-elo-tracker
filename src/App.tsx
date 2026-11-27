import { useLayoutEffect } from 'react';
import {
    Navigate,
    Outlet,
    Route,
    RouterProvider,
    createBrowserRouter,
    createRoutesFromElements,
    useLocation,
    useNavigationType,
} from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './auth/AuthProvider';
import { EditorsOnly } from './auth/EditorsOnly';
import { ThemeProvider } from './state/ThemeProvider';
import { ToastProvider } from './state/ToastProvider';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ProtectedApp } from './pages/ProtectedApp';
import { DashboardPage } from './pages/DashboardPage';
import { RankingsPage } from './pages/RankingsPage';
import { MatchesPage } from './pages/MatchesPage';
import { PlayersPage } from './pages/PlayersPage';
import { PlayerProfilePage } from './pages/PlayerProfilePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { MatchupPage } from './pages/MatchupPage';
import { SettingsPage } from './pages/SettingsPage';

const basename =
    import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

/** A new page starts at its top; Back and Forward keep the browser's own scroll. */
function Root() {
    const { pathname } = useLocation();
    const navType = useNavigationType();
    useLayoutEffect(() => {
        if (navType !== 'POP') window.scrollTo(0, 0);
    }, [pathname, navType]);
    return <Outlet />;
}

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route element={<Root />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app/*" element={<ProtectedApp />}>
                <Route index element={<DashboardPage />} />
                <Route path="rankings" element={<RankingsPage />} />
                <Route path="matches" element={<MatchesPage />} />
                <Route
                    path="players"
                    element={
                        <EditorsOnly>
                            <PlayersPage />
                        </EditorsOnly>
                    }
                />
                <Route path="players/:id" element={<PlayerProfilePage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="matchup" element={<MatchupPage />} />
                <Route
                    path="settings"
                    element={
                        <EditorsOnly>
                            <SettingsPage />
                        </EditorsOnly>
                    }
                />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
    ),
    { basename }
);

/** The path a navigation is headed to, or null when it stays on this page (a ?query change). */
function targetPath(to: unknown): string | null {
    if (typeof to === 'string') {
        if (to.startsWith('?') || to.startsWith('#')) return null;
        return to.split(/[?#]/)[0] || null;
    }
    if (to && typeof to === 'object' && 'pathname' in to) {
        const p = (to as { pathname?: string }).pathname;
        return p || null;
    }
    return null;
}

// Moving to another page cross-fades (a View Transition, where the browser has
// them); changing a filter in the address bar on the same page doesn't, so
// picking things stays instant. Pages opt out with viewTransition: false.
const canFade = () =>
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const navigate = router.navigate.bind(router);
router.navigate = ((to: Parameters<typeof navigate>[0], opts?: Parameters<typeof navigate>[1]) => {
    if (typeof to === 'number') return navigate(to, opts);
    const path = targetPath(to);
    const leaving = path !== null && path !== router.state.location.pathname;
    // (links pass viewTransition: undefined explicitly, so fill it in rather than spread under it)
    return navigate(to, leaving && canFade() ? { ...opts, viewTransition: opts?.viewTransition ?? true } : opts);
}) as typeof router.navigate;

export function App() {
    return (
        // layout animations (the sliding tab bar) follow the reduced-motion setting
        <MotionConfig reducedMotion="user">
            <ThemeProvider>
                <ToastProvider>
                    <AuthProvider>
                        <RouterProvider router={router} />
                    </AuthProvider>
                </ToastProvider>
            </ThemeProvider>
        </MotionConfig>
    );
}
