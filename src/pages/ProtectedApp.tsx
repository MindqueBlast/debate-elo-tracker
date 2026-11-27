import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { useGuestAccess } from '../state/useGuestAccess';
import { AppDataProvider } from '../state/AppDataProvider';
import { AppShell } from '../components/AppShell';

export function ProtectedApp() {
    const { role, loading, isGuest, signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    // checked fresh, so a guest who's already in finds out on their next visit
    const guestOk = useGuestAccess(isGuest);

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

    if (isGuest && !guestOk) {
        return (
            <div className="page guest-off">
                <h1>Guest browsing is off</h1>
                <p className="note">An admin has turned it off for now. Sign in with your Google account to keep going.</p>
                <Button
                    onClick={async () => {
                        await signOut();
                        navigate('/login');
                    }}
                >
                    Sign in
                </Button>
            </div>
        );
    }

    return (
        <AppDataProvider enabled>
            <AppShell />
        </AppDataProvider>
    );
}
