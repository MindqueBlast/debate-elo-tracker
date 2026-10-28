import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Logo } from '../components/Logo';
import { AppBackground } from '../components/AppBackground';
import { ScalesMotif } from '../components/illustrations';

export function LoginPage() {
    const { role, loading, signIn, error, enterGuestMode, enterDevMode } =
        useAuth();

    if (!loading && role) return <Navigate to="/app" replace />;

    return (
        <div className="login-page">
            <AppBackground variant="login" />
            <Card className="login-card">
                <div className="login-card__illus" aria-hidden="true">
                    <ScalesMotif size={72} tone="accent" />
                </div>
                <div
                    className="brand"
                    style={{ justifyContent: 'center', marginBottom: 12 }}
                >
                    <Logo />
                    Syosset Debate Elo Tracker
                </div>
                <h1 style={{ fontSize: 28, marginBottom: 8 }}>Sign in</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                    Continue as a guest to browse rankings and history, or sign
                    in with an allowlisted Google account. Admins can record
                    results; guests and viewers are read-only.
                </p>
                {error && (
                    <p style={{ color: 'var(--loss)', marginBottom: 12 }}>{error}</p>
                )}
                <Button onClick={() => void signIn()} style={{ width: '100%' }}>
                    Sign in with Google
                </Button>
                <Button
                    variant="secondary"
                    style={{ width: '100%', marginTop: 10 }}
                    onClick={enterGuestMode}
                >
                    Continue as guest
                </Button>
                {import.meta.env.DEV && (
                    <Button
                        variant="ghost"
                        style={{ width: '100%', marginTop: 10 }}
                        onClick={enterDevMode}
                    >
                        Continue in test mode
                    </Button>
                )}
            </Card>
        </div>
    );
}
