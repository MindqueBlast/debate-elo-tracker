import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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

export function App() {
    return (
        // layout animations (the sliding tab bar) follow the reduced-motion setting
        <MotionConfig reducedMotion="user">
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <BrowserRouter basename={basename}>
                        <Routes>
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
                                <Route
                                    path="players/:id"
                                    element={<PlayerProfilePage />}
                                />
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
                        </Routes>
                    </BrowserRouter>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
        </MotionConfig>
    );
}
