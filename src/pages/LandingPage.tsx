import { useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useTheme } from '../state/ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import { SeasonReplay } from '../components/SeasonReplay';
import '../styles/landing.css';

/** Screens captured from the tracker itself (guest view), one per theme. */
const SHOTS = {
    chart: { w: 1400, h: 805, alt: 'Elo history chart for the class of 2027, one line per debater across four seasons, with tournament dates marked along the bottom' },
    rankings: { w: 1600, h: 899, alt: 'The rankings board: each debater’s place, name, a bar for where their rating stands, and their Elo' },
    teams: { w: 1600, h: 966, alt: 'Team rankings: each partnership’s place and the average Elo of both partners' },
    profile: { w: 1600, h: 941, alt: 'A debater’s profile: current Elo and rank, peak, tournaments, partners and an Elo history chart' },
    tournaments: { w: 1202, h: 1200, alt: 'The tournament list with its search box: each tournament’s entries and rating changes' },
    tournament: { w: 1158, h: 956, alt: 'NYSFL States results: every pair’s raw wins and each person’s rating change' },
    phone: { w: 780, h: 1688, alt: 'The dashboard on a phone: three figures on the scoreboard and the top of the board' },
    compare: { w: 1500, h: 863, alt: 'Analytics with two debaters’ Elo lines shown and the rest of their class hidden' },
} as const;
type ShotName = keyof typeof SHOTS;

/** A tighter crop for phones, where the full chart's labels would be too small to read. */
const PHONE_CROPS: Partial<Record<ShotName, { file: string; w: number; h: number }>> = {
    chart: { file: 'chart-phone', w: 624, h: 642 },
    rankings: { file: 'rankings-phone', w: 716, h: 1234 },
    teams: { file: 'teams-phone', w: 716, h: 1234 },
    profile: { file: 'profile-phone', w: 716, h: 1814 },
    tournament: { file: 'tournament-phone', w: 672, h: 956 },
    tournaments: { file: 'tournaments-phone', w: 716, h: 1520 },
    compare: { file: 'compare-phone', w: 624, h: 642 },
};

const shotUrl = (file: string, theme: string) =>
    `${import.meta.env.BASE_URL}landing/${file}-${theme === 'light' ? 'light' : 'dark'}.webp`;

function Shot({
    name,
    theme,
    caption,
    eager = false,
    edge = false,
    className = '',
}: {
    name: ShotName;
    theme: string;
    caption?: string;
    eager?: boolean;
    /** a hairline edge, for captures that don't carry their own card border */
    edge?: boolean;
    className?: string;
}) {
    const s = SHOTS[name];
    const phone = PHONE_CROPS[name];
    return (
        <figure className={`l-shot ${edge ? 'l-shot--edge' : ''} ${className}`.trim()}>
            <picture>
                {phone && (
                    <source
                        media="(max-width: 40rem)"
                        srcSet={shotUrl(phone.file, theme)}
                        width={phone.w}
                        height={phone.h}
                    />
                )}
                <img
                    src={shotUrl(name, theme)}
                    width={s.w}
                    height={s.h}
                    alt={s.alt}
                    loading={eager ? 'eager' : 'lazy'}
                    fetchPriority={eager ? 'high' : 'auto'}
                    decoding="async"
                />
            </picture>
            {caption && <figcaption>{caption}</figcaption>}
        </figure>
    );
}

const VIEWS: { key: 'rankings' | 'teams' | 'profile' | 'tournaments'; label: string; note: string }[] = [
    { key: 'rankings', label: 'Rankings', note: 'Everyone active this season, ordered by Elo.' },
    { key: 'teams', label: 'Teams', note: 'Partnerships ranked by the average of both partners.' },
    { key: 'profile', label: 'Profiles', note: 'Peak Elo, consistency, tournaments, partners and a rating chart for each person.' },
    { key: 'tournaments', label: 'Tournaments', note: 'Every tournament, searchable by name or person, with each entry’s change.' },
];

export function LandingPage() {
    const { toggle, theme } = useTheme();
    const { enterGuestMode, role } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState<(typeof VIEWS)[number]['key']>('rankings');
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // already signed in (or browsing as a guest): one way back in, no sign-in buttons
    const counter = role ? (
        <div className="l-counter">
            <Link to="/app" className="l-btn">
                Open Tracker
            </Link>
        </div>
    ) : (
        <div className="l-counter">
            <button type="button" className="l-btn" onClick={browseAsGuest}>
                Browse as guest
            </button>
            <Link to="/login" className="l-btn l-btn--line">
                Sign in
            </Link>
        </div>
    );

    function browseAsGuest() {
        enterGuestMode();
        navigate('/app');
    }

    function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = VIEWS.findIndex((v) => v.key === view);
        const next = (i + (e.key === 'ArrowRight' ? 1 : VIEWS.length - 1)) % VIEWS.length;
        setView(VIEWS[next].key);
        tabRefs.current[next]?.focus();
    }

    const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];

    return (
        <div className="landing">
            <a className="l-skip" href="#landing-main">
                Skip to content
            </a>
            {/* the hero is the club's colour, in both themes */}
            <div className="l-hero">
                <header className="l-nav">
                    <div className="l-container l-nav__inner">
                        <Link to="/" className="l-wordmark" aria-label="Syosset Debate Elo Tracker, home">
                            <Logo size={28} />
                            <span className="l-wordmark__full">Syosset Debate Elo Tracker</span>
                            <span className="l-wordmark__short">Syosset Elo</span>
                        </Link>
                        <div className="l-nav__actions">
                            <button type="button" className="l-text-btn" onClick={toggle}>
                                {theme === 'dark' ? 'Light' : 'Dark'}
                            </button>
                            {role ? (
                                <Link to="/app" className="l-btn l-btn--line l-btn--small">
                                    Open Tracker
                                </Link>
                            ) : (
                                <Link to="/login" className="l-btn l-btn--line l-btn--small">
                                    Enter Tracker
                                </Link>
                            )}
                        </div>
                    </div>
                </header>

                <main id="landing-main">
                    <section className="l-container l-hero__grid" aria-labelledby="landing-title">
                        <div className="l-hero__text">
                            <h1 id="landing-title">
                                <span>Syosset PF,</span> <span>ranked by Elo.</span>
                            </h1>
                            <p className="l-hero__line">
                                Every tournament result moves each debater’s Elo, charted season by season.
                            </p>
                            {counter}
                            <p className="l-hero__terms">Guests see everything. Only admins record results.</p>
                            <p className="l-byline">
                                By <strong>Aaditya Sahu</strong> and <strong>Jiayi Meng</strong>
                            </p>
                        </div>
                        <div className="l-hero__board">
                            <SeasonReplay fallback={<Shot name="chart" theme={theme} eager edge />} />
                        </div>
                    </section>
                </main>
            </div>

            <div className="l-body">
                <section className="l-section l-does" aria-labelledby="landing-does">
                    <div className="l-container">
                        <div className="l-head">
                            <h2 id="landing-does">What the tracker does, and doesn’t</h2>
                            <p className="l-lead">One rating per debater, built from every recorded result.</p>
                        </div>
                        <div className="l-ledger">
                            <div className="l-ledger__col">
                                <h3>It does</h3>
                                <ul>
                                    <li>Rank every debater by Elo from tournament results.</li>
                                    <li>Count recorded practice rounds, too.</li>
                                    <li>Adjust each result for division and the field.</li>
                                    <li>Chart each person’s rating across every season.</li>
                                    <li>Let admins fix or undo any result, then recalculate everyone.</li>
                                </ul>
                            </div>
                            <div className="l-ledger__col l-ledger__col--no">
                                <h3>It doesn’t</h3>
                                <ul>
                                    <li>Count speaker points.</li>
                                    <li>Rank events other than Public Forum.</li>
                                    <li>Let guests change anything.</li>
                                    <li>Move a rating when someone skips a tournament.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="l-section" aria-labelledby="landing-look">
                    <div className="l-container l-split l-split--4-8">
                        <div className="l-head">
                            <h2 id="landing-look">Every screen guests can open</h2>
                            <div className="l-tabs" role="tablist" aria-label="Screens" onKeyDown={onTabKey}>
                                {VIEWS.map((v, i) => (
                                    <button
                                        key={v.key}
                                        ref={(el) => {
                                            tabRefs.current[i] = el;
                                        }}
                                        type="button"
                                        role="tab"
                                        id={`landing-tab-${v.key}`}
                                        aria-selected={view === v.key}
                                        aria-controls="landing-screen"
                                        tabIndex={view === v.key ? 0 : -1}
                                        onClick={() => setView(v.key)}
                                    >
                                        {v.label}
                                    </button>
                                ))}
                            </div>
                            <p className="l-tab-note">{current.note}</p>
                        </div>
                        <div role="tabpanel" id="landing-screen" aria-labelledby={`landing-tab-${view}`}>
                            <Shot key={view} name={view} theme={theme} />
                        </div>
                    </div>
                </section>

                <section className="l-section" aria-labelledby="landing-counts">
                    <div className="l-container l-split l-split--6-6">
                        <div>
                            <h2 id="landing-counts">How a tournament moves your Elo</h2>
                            <dl className="l-rows">
                                <div>
                                    <dt>Graded by division</dt>
                                    <dd>Varsity is held to a higher bar than JV, and JV than novice.</dd>
                                </div>
                                <div>
                                    <dt>Against the field</dt>
                                    <dd>Each result is compared with what your rating predicts there.</dd>
                                </div>
                                <div>
                                    <dt>Partners apart</dt>
                                    <dd>Each partner’s change is worked out from their own Elo.</dd>
                                </div>
                                <div>
                                    <dt>Smoothed swings</dt>
                                    <dd>A big result counts in small steps, so it’s worth less as it lifts you.</dd>
                                </div>
                            </dl>
                        </div>
                        <Shot
                            name="tournament"
                            theme={theme}
                            edge
                            caption="NYSFL States: each pair’s raw wins and each person’s change."
                        />
                    </div>
                </section>

                <section className="l-section" aria-labelledby="landing-phone">
                    <div className="l-container l-split l-split--7-5">
                        <div>
                            <h2 id="landing-phone">Guests read, admins record</h2>
                            <dl className="l-rows">
                                <div>
                                    <dt>Guests</dt>
                                    <dd>Browse rankings, charts and every profile.</dd>
                                </div>
                                <div>
                                    <dt>Viewers</dt>
                                    <dd>Sign in with an allowlisted Google account, read-only.</dd>
                                </div>
                                <div>
                                    <dt>Admins</dt>
                                    <dd>Record results and fix old ones.</dd>
                                </div>
                            </dl>
                        </div>
                        <Shot name="phone" theme={theme} edge className="l-phone" caption="The dashboard on a phone." />
                    </div>
                </section>
            </div>

            <section className="l-close" aria-labelledby="landing-stand">
                <div className="l-container l-split l-split--5-7">
                    <div className="l-head">
                        <h2 id="landing-stand">Find your name on the board</h2>
                        {counter}
                    </div>
                    <Shot name="compare" theme={theme} edge caption="Analytics: any two debaters, side by side." />
                </div>
            </section>

            <footer className="l-footer">
                <div className="l-container">
                    <p className="l-footer__names">Made by Aaditya Sahu and Jiayi Meng</p>
                    <div className="l-footer__row">
                        <Link to="/" className="l-wordmark">
                            <Logo />
                            Syosset Debate Elo Tracker
                        </Link>
                        <div className="l-footer__links">
                            {role ? (
                                <Link to="/app" className="l-text-btn">
                                    Open Tracker
                                </Link>
                            ) : (
                                <>
                                    <button type="button" className="l-text-btn" onClick={browseAsGuest}>
                                        Browse as guest
                                    </button>
                                    <Link to="/login" className="l-text-btn">
                                        Sign in
                                    </Link>
                                </>
                            )}
                        </div>
                        <p className="l-footer__legal">© 2026 Syosset PF</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
