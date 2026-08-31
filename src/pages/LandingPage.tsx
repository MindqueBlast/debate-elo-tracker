import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { AppBackground } from '../components/AppBackground';
import { useTheme } from '../state/ThemeProvider';
import {
    shouldAnimateDecorative,
    useReducedMotion,
} from '../lib/motion';
import {
    DebatePodium,
    EloCurveMotif,
    FeatureIcon,
} from '../components/illustrations';

function HeroScene({ animated }: { animated: boolean }) {
    return (
        <svg
            className="hero-visual"
            viewBox="0 0 520 420"
            fill="none"
            role="img"
            aria-label="Animated Elo progression with debate podium"
        >
            <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--accent)" />
                </linearGradient>
            </defs>
            <g opacity="0.5">
                <path
                    d="M380 340 H460 V380 H380 Z M400 300 H420 V340 H400 Z M410 260 H430 V300 H410 Z"
                    stroke="currentColor"
                    strokeOpacity="0.15"
                    strokeWidth="1.5"
                    fill="var(--accent)"
                    fillOpacity="0.04"
                />
            </g>
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
            <rect
                x="48"
                y="48"
                width="424"
                height="280"
                rx="12"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="1.5"
                fill="var(--bg-raised)"
                fillOpacity="0.3"
            />
            <path
                d="M64 300 C 120 290, 150 210, 210 200 S 300 240, 360 150 S 450 80, 490 70"
                stroke="url(#lineGrad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={animated ? 720 : undefined}
                strokeDashoffset={animated ? 720 : undefined}
            >
                {animated && (
                    <animate
                        attributeName="stroke-dashoffset"
                        values="720;0"
                        dur="2.4s"
                        fill="freeze"
                    />
                )}
            </path>
            <circle cx="210" cy="200" r="5" fill="var(--accent)">
                {animated && (
                    <animate
                        attributeName="opacity"
                        values="0;1"
                        dur="0.4s"
                        begin="0.8s"
                        fill="freeze"
                    />
                )}
            </circle>
            <g opacity={animated ? 0 : 1}>
                {animated && (
                    <animate
                        attributeName="opacity"
                        values="0;1"
                        dur="0.5s"
                        begin="1.4s"
                        fill="freeze"
                    />
                )}
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
                <text x="316" y="112" fill="currentColor" fontSize="12" opacity="0.7">
                    Rank 1
                </text>
                <text
                    x="316"
                    y="132"
                    fill="var(--accent)"
                    fontSize="16"
                    fontWeight="600"
                >
                    1684 Elo
                </text>
            </g>
        </svg>
    );
}

function DashboardPreviewMock() {
    return (
        <svg
            viewBox="0 0 480 320"
            fill="none"
            className="preview-mock"
            role="img"
            aria-label="Dashboard preview mockup"
        >
            <rect width="480" height="320" rx="12" fill="var(--bg-elevated)" />
            <rect x="12" y="12" width="456" height="36" rx="8" fill="var(--bg-hover)" />
            {['Dashboard', 'Rankings', 'Matches'].map((label, i) => (
                <rect
                    key={label}
                    x={16 + i * 72}
                    y="20"
                    width="64"
                    height="20"
                    rx="6"
                    fill={i === 0 ? 'var(--accent-soft)' : 'transparent'}
                    stroke={i === 0 ? 'var(--accent)' : 'var(--line)'}
                    strokeOpacity={i === 0 ? 0.5 : 1}
                    strokeWidth="1"
                />
            ))}
            <text x="24" y="34" fill="currentColor" fontSize="9" opacity="0.6">
                Dashboard
            </text>
            <rect x="12" y="56" width="280" height="232" rx="8" fill="var(--bg-raised)" stroke="var(--line)" />
            <text x="24" y="80" fill="currentColor" fontSize="10" opacity="0.5">
                TOP PLAYERS
            </text>
            {[
                { y: 96, rank: 1, elo: '1684', tone: 'var(--gold)' },
                { y: 128, rank: 2, elo: '1612', tone: 'var(--silver)' },
                { y: 160, rank: 3, elo: '1579', tone: 'var(--bronze)' },
            ].map((row) => (
                <g key={row.rank}>
                    <rect x="20" y={row.y} width="4" height="28" rx="2" fill={row.tone} />
                    <text x="32" y={row.y + 18} fill="currentColor" fontSize="11">
                        #{row.rank} Player
                    </text>
                    <text
                        x="250"
                        y={row.y + 18}
                        fill="var(--accent)"
                        fontSize="11"
                        fontWeight="600"
                    >
                        {row.elo}
                    </text>
                </g>
            ))}
            <rect x="300" y="56" width="168" height="112" rx="8" fill="var(--bg-raised)" stroke="var(--line)" />
            <path
                d="M312 140 L328 120 L344 128 L368 100 L392 108 L416 88 L440 72"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <rect x="300" y="180" width="80" height="56" rx="8" fill="var(--accent-soft)" />
            <text x="312" y="204" fill="currentColor" fontSize="9" opacity="0.5">
                AVG ELO
            </text>
            <text x="312" y="222" fill="var(--accent)" fontSize="14" fontWeight="600">
                1542
            </text>
            <rect x="388" y="180" width="80" height="56" rx="8" fill="var(--bg-hover)" />
            <text x="400" y="204" fill="currentColor" fontSize="9" opacity="0.5">
                ROUNDS
            </text>
            <text x="400" y="222" fill="currentColor" fontSize="14" fontWeight="600">
                248
            </text>
        </svg>
    );
}

const FEATURES: Array<{
    kind: 'rankings' | 'matches' | 'chart' | 'profile' | 'analytics' | 'tournament';
    title: string;
    body: string;
}> = [
    {
        kind: 'rankings',
        title: 'Live Rankings',
        body: 'Active roster ordered by Elo, with win rate from practice rounds.',
    },
    {
        kind: 'matches',
        title: 'Match History',
        body: 'Every practice result and tournament swing, searchable and undoable for admins.',
    },
    {
        kind: 'chart',
        title: 'Elo Progress',
        body: 'Date-accurate history graphs with comparison, ranges, and important dates.',
    },
    {
        kind: 'profile',
        title: 'Player Profiles',
        body: 'Peak Elo, consistency, tournament count, and recent form.',
    },
    {
        kind: 'analytics',
        title: 'Performance Analytics',
        body: 'Club-wide charts without compressing the scale to zero.',
    },
    {
        kind: 'tournament',
        title: 'Tournament Results',
        body: 'Division-adjusted wins, field strength, and capped rating changes.',
    },
];

export function LandingPage() {
    const { toggle, theme } = useTheme();
    const reduced = useReducedMotion();
    const animated = shouldAnimateDecorative(reduced);

    return (
        <div className="landing-root">
            <AppBackground variant="cinematic" />
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
                    <div className="hero-ctas">
                        <Link to="/login" className="btn">
                            Enter Tracker
                        </Link>
                        <Link to="/login" className="btn btn-secondary">
                            Explore Rankings
                        </Link>
                    </div>
                    <div className="hero-mini-motifs" aria-hidden="true">
                        <DebatePodium size={48} tone="accent" />
                        <EloCurveMotif size={64} tone="muted" animated={animated} />
                    </div>
                </div>
                <HeroScene animated={animated} />
            </section>
            <section className="features">
                {FEATURES.map((f) => (
                    <article className="feature" key={f.title}>
                        <div className="feature__icon">
                            <FeatureIcon kind={f.kind} size={40} tone="accent" />
                        </div>
                        <h3>{f.title}</h3>
                        <p>{f.body}</p>
                    </article>
                ))}
            </section>
            <section className="preview" aria-label="Dashboard preview">
                <div className="preview-bar">Dashboard preview</div>
                <div className="preview-body preview-body--mock">
                    <DashboardPreviewMock />
                </div>
            </section>
            <footer className="landing-footer">
                © 2026 Syosset PF — Aaditya Sahu & Jiayi Meng
            </footer>
        </div>
    );
}
