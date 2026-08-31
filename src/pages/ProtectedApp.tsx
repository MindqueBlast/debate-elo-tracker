import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AppDataProvider } from '../state/AppDataProvider';
import { AppShell } from '../components/AppShell';

export function ProtectedApp() {
    const { role, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="page" style={{ textAlign: 'center', paddingTop: 120 }}>
                Loading Syosset Debate Elo Tracker…
            </div>
        );
    }

    if (!role) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return (
        <AppDataProvider enabled>
            <AppShell />
        </AppDataProvider>
    );
}
