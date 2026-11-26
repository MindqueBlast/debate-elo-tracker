import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../data/supabase';
import { useReducedMotion } from '../lib/motion';

interface Person {
    id: string;
    name: string;
    start: string;
    startElo: number;
    graduated: string | null;
    /** Rating after each result, oldest first. */
    history: { date: string; elo: number }[];
}

const SHOWN = 8;
/** How long the whole replay runs, first tournament to today. */
const RUN_MS = 8000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

async function loadPeople(): Promise<Person[]> {
    const { data, error } = await supabase
        .from('debaters')
        .select('id, name, start_elo, start_date, status, graduation_date, history');
    if (error) throw error;
    return (data ?? []).map((d) => ({
        id: String(d.id),
        name: String(d.name),
        start: String(d.start_date ?? '0000-00-00'),
        startElo: Number(d.start_elo) || 400,
        graduated: d.status === 'graduated' ? (d.graduation_date as string | null) ?? '0000-00-00' : null,
        history: (Array.isArray(d.history) ? d.history : [])
            .map((p: { date?: unknown; elo?: unknown }) => ({ date: String(p.date), elo: Number(p.elo) }))
            .filter((p: { date: string; elo: number }) => p.date && Number.isFinite(p.elo))
            .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)),
    }));
}

/** Who was on the team on a day, and their rating after that day's results. */
function boardOn(people: Person[], day: string) {
    const rows: { id: string; name: string; elo: number }[] = [];
    for (const p of people) {
        if (p.start > day) continue;
        if (p.graduated && p.graduated < day) continue;
        let elo = p.startElo;
        let played = false;
        for (const h of p.history) {
            if (h.date > day) break;
            elo = h.elo;
            played = true;
        }
        // only people with a result so far are on the board
        if (played) rows.push({ id: p.id, name: p.name, elo });
    }
    return rows.sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name)).slice(0, SHOWN);
}

/**
 * The landing's opening: the team's board replayed from the first recorded
 * tournament to today. Each month with results is one frame, so places swap as
 * results come in, rails lengthen as ratings climb from the 400 everyone
 * starts at, and seniors leave the board the day they graduate. Reduced motion
 * shows today's board, still.
 */
export function SeasonReplay({ fallback = null }: { fallback?: ReactNode }) {
    const reduced = useReducedMotion();
    const [people, setPeople] = useState<Person[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [frame, setFrame] = useState(0);
    const [run, setRun] = useState(0);

    useEffect(() => {
        let live = true;
        loadPeople()
            .then((p) => live && setPeople(p))
            .catch(() => live && setFailed(true));
        return () => {
            live = false;
        };
    }, []);

    // one frame per month with results (its last recorded day), oldest first,
    // so each reshuffle has time to settle before the next
    const days = useMemo(() => {
        if (!people) return [];
        const lastInMonth = new Map<string, string>();
        for (const p of people)
            for (const h of p.history) {
                const m = h.date.slice(0, 7);
                if (!lastInMonth.has(m) || lastInMonth.get(m)! < h.date) lastInMonth.set(m, h.date);
            }
        return [...lastInMonth.values()].sort();
    }, [people]);
    // rails are measured against the best rating anyone reached, so they grow over the years
    const ceiling = useMemo(
        () => Math.max(500, ...(people ?? []).flatMap((p) => p.history.map((h) => h.elo))),
        [people]
    );
    const last = Math.max(0, days.length - 1);

    useEffect(() => {
        if (!days.length) return;
        if (reduced) {
            setFrame(last);
            return;
        }
        setFrame(0);
        const step = RUN_MS / days.length;
        let i = 0;
        let timer = 0;
        // a short hold on the first board, then one frame per recorded day
        const start = window.setTimeout(() => {
            timer = window.setInterval(() => {
                i += 1;
                setFrame(Math.min(i, last));
                if (i >= last) window.clearInterval(timer);
            }, step);
        }, 700);
        return () => {
            window.clearTimeout(start);
            window.clearInterval(timer);
        };
    }, [days, last, reduced, run]);

    // no data (offline, or the database is down): show the fallback instead
    if (failed) return <>{fallback}</>;

    const day = days[frame];
    const board = people && day ? boardOn(people, day) : [];
    const floor = 300;
    const share = (elo: number) => Math.max(0.03, Math.min(1, (elo - floor) / (ceiling - floor)));
    const done = !!day && frame >= last;

    return (
        <figure className="replay" aria-labelledby="replay-title">
            <div className="replay__head">
                <h2 id="replay-title" className="replay__title">
                    The board
                </h2>
                <span className="replay__date figure" aria-hidden="true">
                    {day ? (done ? 'Today' : monthLabel(day)) : ' '}
                </span>
            </div>
            <ol className="replay__lanes" aria-label={done ? 'Top eight today' : 'Top eight, replaying past seasons'}>
                {board.length === 0
                    ? Array.from({ length: SHOWN }, (_, i) => (
                          <li key={i} className="replay__lane replay__lane--empty" aria-hidden="true">
                              <span className="replay__rank figure">{i + 1}</span>
                              <span className="replay__name" />
                              <span className="replay__rail" />
                              <span className="replay__elo figure" />
                          </li>
                      ))
                    : board.map((r, i) => (
                          // places swap by sliding; someone new to the board slides in
                          // with a CSS entrance, which always ends fully visible
                          <motion.li
                              key={r.id}
                              layout="position"
                              transition={{ type: 'spring', stiffness: 620, damping: 48 }}
                              className={`replay__lane${i < 3 ? ` replay__lane--${i + 1}` : ''}`}
                          >
                              <span className="replay__rank figure">{i + 1}</span>
                              <span className="replay__name">{r.name}</span>
                              <span className="replay__rail" aria-hidden="true">
                                  <i style={{ transform: `scaleX(${share(r.elo)})` }} />
                              </span>
                              <span className="replay__elo figure">{Math.round(r.elo)}</span>
                          </motion.li>
                      ))}
            </ol>
            <figcaption className="replay__foot">
                <span>
                    {done || reduced
                        ? 'Live from the tracker: the top eight on the team today.'
                        : 'Every recorded tournament since 2023, replayed.'}
                </span>
                {!reduced && done && (
                    <button type="button" className="replay__again" onClick={() => setRun((n) => n + 1)}>
                        Replay
                    </button>
                )}
            </figcaption>
        </figure>
    );
}
