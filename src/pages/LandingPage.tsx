import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { useTheme } from '../state/ThemeProvider';

function HeroGraph() {
    return (
        <svg
            className="hero-visual"
            viewBox="0 0 520 420"
            fill="none"
            role="img"
            aria-label="Animated Elo progression"
        >
            <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#dc3b3b" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#dc3b3b" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {[80, 160, 240, 320].map((y) => (
                <line
                    key={y}
                    x1="40"
                    x2="500"
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                />
            ))}
            <path
                d="M48 300 C 120 290, 150 210, 210 200 S 300 240, 360 150 S 450 80, 490 70"
                stroke="url(#lineGrad)"
                strokeWidth="3"
                filter="url(#glow)"
                strokeDasharray="720"
                strokeDashoffset="720"
            >
                <animate
                    attributeName="stroke-dashoffset"
                    values="720;0"
                    dur="2.4s"
                    fill="freeze"
                />
            </path>
            <circle cx="210" cy="200" r="5" fill="#dc3b3b">
                <animate
                    attributeName="opacity"
                    values="0;1"
                    dur="0.4s"
                    begin="0.8s"
                    fill="freeze"
                />
            </circle>
            <g opacity="0">
                <animate
                    attributeName="opacity"
                    values="0;1"
                    dur="0.5s"
                    begin="1.4s"
                    fill="freeze"
                />
                <rect
                    x="300"
                    y="86"
                    width="150"
                    height="58"
                    rx="10"
                    fill="currentColor"
                    fillOpacity="0.06"
                    stroke="currentColor"
                    strokeOpacity="0.12"
                />
                <text x="316" y="112" fill="currentColor" fontSize="12">
                    Rank 1
                </text>
                <text x="316" y="132" fill="#dc3b3b" fontSize="16" fontWeight="600">
                    1684 Elo
                </text>
            </g>
        </svg>
    );
}

export function LandingPage() {
    const { toggle, theme } = useTheme();
    return (
        <div>
            <div className="app-bg" aria-hidden="true" />
            <header className="landing-nav">
                <div className="brand">
                    <Logo />
                    Syosset Debate Elo Tracker
                </div>
                <div className="row">
                    <Button variant="ghost" size="sm" onClick={toggle}>
                        {theme === 'dark' ? 'Light' : 'Dark'}
                    </Button>
                    <Link to="/login" className="btn btn-sm">
                        Enter Tracker
                    </Link>
                </div>
            </header>
            <section className="hero">
                <div>
                    <div className="page-kicker">Syosset PF</div>
                    <h1>
                        Measure performance.
                        <br />
                        Track progress.
                        <br />
                        Compete better.
                    </h1>
                    <p className="lede">
                        The club rating system for Syosset Public Forum. Practice
                        rounds, tournament results, and Elo history in one
                        competitive record.
                    </p>
                    <Link to="/login" className="btn">
                        Enter Tracker
                    </Link>
                    <Link to="/login" className="btn btn-secondary">
                        Explore Rankings
                    </Link>
                </div>
                <HeroGraph />
            </section>
            <section className="features">
                {[
                    ['Live Rankings', 'Active roster ordered by Elo, with win rate from practice rounds.'],
                    ['Match History', 'Every practice result and tournament swing, searchable and undoable for admins.'],
                    ['Elo Progress', 'Date-accurate history graphs with comparison, ranges, and important dates.'],
                    ['Player Profiles', 'Peak Elo, consistency, tournament count, and recent form.'],
                    ['Performance Analytics', 'Club-wide charts without compressing the scale to zero.'],
                    ['Tournament Results', 'Division-adjusted wins, field strength, and capped rating changes.'],
                ].map(([title, body]) => (
                    <article className="feature" key={title}>
                        <h3>{title}</h3>
                        <p>{body}</p>
                    </article>
                ))}
            </section>
            <section className="preview" aria-label="Dashboard preview">
                <div className="preview-bar">Dashboard preview</div>
                <div className="preview-body">
                    <div style={{ padding: 24 }}>
                        <div className="page-kicker">Now</div>
                        <h2 style={{ fontSize: 28, marginBottom: 16 }}>Top of the board</h2>
                        {['#1  1684', '#2  1612', '#3  1579'].map((row) => (
                            <div key={row} className="list-row rank-1">
                                <span className="elo">{row}</span>
                            </div>
                        ))}
                    </div>
                    <div
                        style={{
                            borderLeft: '1px solid var(--line)',
                            padding: 24,
                        }}
                    >
                        <div className="card-title">Recent Elo</div>
                        <HeroGraph />
                    </div>
                </div>
            </section>
            <footer className="landing-footer">
                © 2026 Syosset PF — Aaditya Sahu & Jiayi Meng
            </footer>
        </div>
    );
}
