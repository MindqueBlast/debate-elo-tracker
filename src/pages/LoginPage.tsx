import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Logo } from '../components/Logo';

export function LoginPage() {
    const { role, loading, signIn, error, enterDevMode } = useAuth();

    if (!loading && role) return <Navigate to="/app" replace />;

    return (
        <div>
            <div className="app-bg" aria-hidden="true" />
            <Card className="login-card">
                <div
                    className="brand"
                    style={{ justifyContent: 'center', marginBottom: 12 }}
                >
                    <Logo />
                    Syosset Debate Elo Tracker
                </div>
                <h1 style={{ fontSize: 28, marginBottom: 8 }}>Sign in</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                    Google accounts on the club allowlist can enter the tracker.
                    Admins can record results; viewers can follow the board.
                </p>
                {error && (
                    <p style={{ color: 'var(--loss)', marginBottom: 12 }}>{error}</p>
                )}
                <Button onClick={() => void signIn()} style={{ width: '100%' }}>
                    Sign in with Google
                </Button>
                {import.meta.env.DEV && (
                    <Button
                        variant="secondary"
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
