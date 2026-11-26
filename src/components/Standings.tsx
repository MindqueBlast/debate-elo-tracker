import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface StandingRow {
    key: string;
    rank: number;
    name: ReactNode;
    elo: number;
    /** Opens this person's profile. */
    to?: string;
    /** Small tags after the name (Grad, Disbanded…). */
    tags?: ReactNode;
    /** Medal colours for the top three (off for, say, disbanded teams). */
    medal?: boolean;
    /** Cells between the name and the rail; hidden on phones. */
    extras?: ReactNode[];
}

/**
 * The board: one lane per person or team, ranked. Each lane has a rail that
 * fills to where that rating sits between the bottom of the board and the top,
 * so the gaps between places are visible, not just the order.
 */
export function Standings({
    rows,
    nameHead = 'Player',
    extraHeads = [],
    head = true,
    label,
}: {
    rows: StandingRow[];
    nameHead?: string;
    extraHeads?: string[];
    head?: boolean;
    label: string;
}) {
    const elos = rows.map((r) => r.elo);
    const top = Math.max(...elos);
    // the rail starts a little under the lowest rating shown (or 400, where everyone begins)
    const floor = Math.min(400, Math.min(...elos)) - 40;
    const share = (elo: number) => (top > floor ? Math.max(0.02, (elo - floor) / (top - floor)) : 1);
    const cols = `var(--lane-rank) minmax(0, 1.25fr) ${extraHeads.map(() => 'minmax(0, 0.9fr)').join(' ')} minmax(64px, 1.6fr) var(--lane-elo)`;

    return (
        <div className="lanes" style={{ '--lane-cols': cols } as CSSProperties}>
            {head && (
                <div className="lane lane--head" aria-hidden="true">
                    <span>Rank</span>
                    <span>{nameHead}</span>
                    {extraHeads.map((h) => (
                        <span key={h} className="hide-sm">
                            {h}
                        </span>
                    ))}
                    <span className="lane__rail-head">Standing</span>
                    <span className="lane__elo-head">Elo</span>
                </div>
            )}
            <ol className="lanes__list" aria-label={label}>
                {rows.map((r, i) => {
                    const medal = r.medal !== false && r.rank <= 3 ? ` lane--medal lane--rank-${r.rank}` : '';
                    const style = { '--i': i, '--share': share(r.elo) } as CSSProperties;
                    const cells = (
                        <>
                            <span className="lane__rank">
                                <span className="sr-only">Rank </span>
                                {r.rank}
                            </span>
                            <span className="lane__name">
                                <strong>{r.name}</strong>
                                {r.tags}
                            </span>
                            {(r.extras ?? []).map((x, j) => (
                                <span key={j} className="lane__extra hide-sm num">
                                    {extraHeads[j] && <span className="sr-only">{extraHeads[j]}: </span>}
                                    {x}
                                </span>
                            ))}
                            <span className="lane__rail" aria-hidden="true">
                                <i />
                            </span>
                            <span className="lane__elo">
                                <span className="sr-only">Elo </span>
                                {Math.round(r.elo)}
                            </span>
                        </>
                    );
                    return (
                        <li key={r.key}>
                            {r.to ? (
                                <Link to={r.to} className={`lane lane--link${medal}`} style={style}>
                                    {cells}
                                </Link>
                            ) : (
                                <div className={`lane${medal}`} style={style}>
                                    {cells}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
