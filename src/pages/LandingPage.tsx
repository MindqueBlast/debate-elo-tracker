import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useTheme } from '../state/ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import { useReducedMotion } from '../lib/motion';
import '../styles/landing.css';

/** Screens captured from the tracker itself (guest view), one per theme. */
const SHOTS = {
    chart: { w: 1400, h: 1048, alt: 'Elo history chart for the class of 2027, three seasons of lines, one per debater' },
    rankings: { w: 1152, h: 944, alt: 'The rankings board: active debaters ordered by Elo' },
    teams: { w: 1600, h: 787, alt: 'Team rankings: each partnership with its division, both partners and their average Elo' },
    profile: { w: 1600, h: 933, alt: 'A debater’s profile: current and peak Elo, tournaments, partners and an Elo history chart' },
    tournaments: { w: 1600, h: 1153, alt: 'The tournament list with its search box: each tournament’s entries and rating changes' },
    tournament: { w: 1300, h: 580, alt: 'NYSFL States results: every pair’s raw wins and each person’s rating change' },
    phone: { w: 780, h: 1688, alt: 'The dashboard on a phone: three figures across and the top of the board' },
    compare: { w: 1500, h: 953, alt: 'Analytics comparing two debaters’ Elo across three seasons' },
} as const;
type ShotName = keyof typeof SHOTS;

/** A tighter crop for phones, where the full chart's labels would be too small to read. */
const PHONE_CROPS: Partial<Record<ShotName, { file: string; w: number; h: number }>> = {
    chart: { file: 'chart-phone', w: 760, h: 770 },
    rankings: { file: 'rankings-phone', w: 720, h: 771 },
    teams: { file: 'teams-phone', w: 720, h: 771 },
    profile: { file: 'profile-phone', w: 720, h: 1139 },
    tournament: { file: 'tournament-phone', w: 720, h: 731 },
    tournaments: { file: 'tournaments-phone', w: 720, h: 1495 },
    compare: { file: 'compare-phone', w: 720, h: 730 },
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

/**
 * A head that types itself once, the first time it scrolls into view. The full
 * text is always laid out (the untyped part is invisible), so nothing jumps, and
 * screen readers get the whole head at once. Reduced motion shows it finished.
 */
function Typed({
    lines,
    as: Tag = 'h2',
    id,
    speed = 34,
    now = false,
}: {
    lines: string[];
    as?: 'h1' | 'h2';
    id?: string;
    speed?: number;
    now?: boolean;
}) {
    const reduced = useReducedMotion();
    const full = lines.join(' ');
    const total = lines.reduce((n, l) => n + l.length, 0);
    const ref = useRef<HTMLHeadingElement>(null);
    const [started, setStarted] = useState(now);
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (started || reduced) return;
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setStarted(true);
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setStarted(true);
                    io.disconnect();
                }
            },
            { rootMargin: '0px 0px -15% 0px' }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [started, reduced]);

    useEffect(() => {
        if (!started || reduced) return;
        let n = 0;
        const timer = window.setInterval(() => {
            n += 1;
            setCount(n);
            if (n >= total) window.clearInterval(timer);
        }, speed);
        return () => window.clearInterval(timer);
    }, [started, reduced, total, speed]);

    const shown = reduced ? total : count;
    const done = shown >= total;
    // where each line starts in the typed run; the caret sits in the line being typed
    const starts = lines.map((_, i) => lines.slice(0, i).reduce((n, l) => n + l.length, 0));
    let caretLine = 0;
    starts.forEach((start, i) => {
        if (start < shown) caretLine = i;
    });
    const showCaret = started && !reduced;
    return (
        <Tag ref={ref} id={id}>
            <span className="l-visually-hidden">{full}</span>
            <span aria-hidden="true">
                {lines.map((line, i) => {
                    const take = Math.max(0, Math.min(line.length, shown - starts[i]));
                    return (
                        <span key={i}>
                            {i > 0 && <br />}
                            {line.slice(0, take)}
                            {showCaret && i === caretLine && (
                                <span className={`l-typed__caret ${done ? 'l-typed__caret--done' : ''}`} />
                            )}
                            <span className="l-typed__rest">{line.slice(take)}</span>
                        </span>
                    );
                })}
            </span>
        </Tag>
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
            <header className="l-nav">
                <div className="l-container l-nav__inner">
                    <Link to="/" className="l-wordmark" aria-label="Syosset Debate Elo Tracker, home">
                        <Logo />
                        <span className="l-wordmark__full">Syosset Debate Elo Tracker</span>
                        <span className="l-wordmark__short">Syosset Elo</span>
                    </Link>
                    <div className="l-nav__actions">
                        <button type="button" className="l-text-btn" onClick={toggle}>
                            {theme === 'dark' ? 'Light' : 'Dark'}
                        </button>
                        {role ? (
                            <Link to="/app" className="l-btn l-btn--quiet l-btn--small">
                                Open Tracker
                            </Link>
                        ) : (
                            <Link to="/login" className="l-btn l-btn--quiet l-btn--small">
                                Enter Tracker
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main id="landing-main">
                <section className="l-hero" aria-labelledby="landing-title">
                    <div className="l-container l-hero__grid">
                        <div className="l-hero__text">
                            <Typed as="h1" id="landing-title" lines={['Syosset PF,', 'ranked by Elo.']} speed={55} now />
                            <p className="l-hero__line">
                                Every tournament result moves each debater’s Elo, charted season by season.
                            </p>
                            <div className="l-counter">
                                <button type="button" className="l-btn" onClick={browseAsGuest}>
                                    Browse as guest
                                </button>
                                <Link to="/login" className="l-btn l-btn--quiet">
                                    Sign in
                                </Link>
                            </div>
                            <p className="l-hero__terms">Guests see everything. Only admins record results.</p>
                            <p className="l-byline">
                                By <strong>Aaditya Sahu</strong> and <strong>Jiayi Meng</strong>
                            </p>
                        </div>
                        <div className="l-hero__visual">
                            <Shot name="chart" theme={theme} eager edge />
                        </div>
                    </div>
                </section>

                <section className="l-section l-section--first l-does" aria-labelledby="landing-does">
                    <div className="l-container">
                        <div className="l-head">
                            <Typed id="landing-does" lines={['What the tracker does,', 'and doesn’t']} />
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

                <section className="l-section l-section--wide-gap" aria-labelledby="landing-look">
                    <div className="l-container l-split l-split--4-8">
                        <div className="l-head">
                            <Typed id="landing-look" lines={['Every screen guests can open']} />
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
                            <Typed id="landing-counts" lines={['How a tournament moves your Elo']} />
                            <dl className="l-rows">
                                <div>
                                    <dt>Wins, adjusted</dt>
                                    <dd>Varsity and JV records are adjusted for their division.</dd>
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
                                    <dt>Capped swings</dt>
                                    <dd>No single tournament can move a rating past its cap.</dd>
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

                <section className="l-section l-section--wide-gap" aria-labelledby="landing-phone">
                    <div className="l-container l-split l-split--7-5">
                        <div>
                            <Typed id="landing-phone" lines={['Guests read, admins record']} />
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

                <section className="l-close" aria-labelledby="landing-stand">
                    <div className="l-container l-split l-split--5-7">
                        <div className="l-head">
                            <Typed id="landing-stand" lines={['Find your name on the board']} />
                            <div className="l-counter">
                                <button type="button" className="l-btn" onClick={browseAsGuest}>
                                    Browse as guest
                                </button>
                                <Link to="/login" className="l-btn l-btn--quiet">
                                    Sign in
                                </Link>
                            </div>
                        </div>
                        <Shot name="compare" theme={theme} edge caption="Analytics: any two debaters, side by side." />
                    </div>
                </section>
            </main>

            <footer className="l-footer">
                <div className="l-container">
                    <p className="l-footer__names">Made by Aaditya Sahu and Jiayi Meng</p>
                    <div className="l-footer__row">
                        <Link to="/" className="l-wordmark">
                            <Logo />
                            Syosset Debate Elo Tracker
                        </Link>
                        <div className="l-footer__links">
                            <button type="button" className="l-text-btn" onClick={browseAsGuest}>
                                Browse as guest
                            </button>
                            <Link to="/login" className="l-text-btn">
                                Sign in
                            </Link>
                        </div>
                        <p className="l-footer__legal">© 2026 Syosset PF</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
