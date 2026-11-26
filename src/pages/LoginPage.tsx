import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { AppBackground } from '../components/AppBackground';

export function LoginPage() {
    const { role, loading, signIn, error, enterGuestMode, enterDevMode } =
        useAuth();

    if (!loading && role) return <Navigate to="/app" replace />;

    return (
        <div className="login-page">
            <AppBackground variant="login" />
            {/* the club's colours on one side, the way in on the other */}
            <section className="login-field" aria-label="Syosset Debate Elo Tracker">
                <Link to="/" className="brand login-field__brand">
                    <Logo size={28} />
                    Syosset Elo
                </Link>
                <p className="login-field__line">Syosset PF, ranked by Elo.</p>
                <p className="login-field__note">Every tournament result moves each debater’s rating.</p>
            </section>
            <main className="login-panel">
                <div className="login-card">
                    <h1>Sign in</h1>
                    <p className="login-card__lead">
                        Continue as a guest to browse rankings and history, or sign
                        in with an allowlisted Google account. Admins can record
                        results; guests and viewers are read-only.
                    </p>
                    {error && (
                        <p className="login-card__error" role="alert">
                            {error}
                        </p>
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
                </div>
            </main>
        </div>
    );
}
