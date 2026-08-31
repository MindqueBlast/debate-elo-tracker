import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
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

const basename =
    import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <BrowserRouter basename={basename}>
                        <Routes>
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/app" element={<ProtectedApp />}>
                                <Route index element={<DashboardPage />} />
                                <Route path="rankings" element={<RankingsPage />} />
                                <Route path="matches" element={<MatchesPage />} />
                                <Route path="players" element={<PlayersPage />} />
                                <Route
                                    path="players/:id"
                                    element={<PlayerProfilePage />}
                                />
                                <Route path="analytics" element={<AnalyticsPage />} />
                            </Route>
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </BrowserRouter>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}
