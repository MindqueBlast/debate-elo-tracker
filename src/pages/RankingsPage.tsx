import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { rankDebaters } from '../domain';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { EmptyRoster, ScalesMotif } from '../components/illustrations';
import { useAppData } from '../state/AppDataProvider';

export function RankingsPage() {
    const { debaters, practiceRounds } = useAppData();
    const [q, setQ] = useState('');
    const [showGraduated, setShowGraduated] = useState(false);
    const ranked = useMemo(
        () => rankDebaters(debaters, practiceRounds, { showGraduated, search: q }),
        [debaters, practiceRounds, showGraduated, q]
    );

    return (
        <div>
            <PageHeader
                kicker="Board"
                title="Rankings"
                illustration={<ScalesMotif size={72} tone="accent" />}
                actions={
                    <label className="row" style={{ alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            checked={showGraduated}
                            onChange={(e) => setShowGraduated(e.target.checked)}
                        />
                        Show graduated
                    </label>
                }
            />
            <input
                className="input"
                placeholder="Search debaters…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ marginBottom: 16, maxWidth: 360 }}
            />
            <Card>
                {ranked.length === 0 ? (
                    <EmptyState
                        title={q ? 'No matches' : 'No players'}
                        body={
                            q
                                ? 'Try a different name.'
                                : 'The leaderboard fills in as the roster grows.'
                        }
                        illustration={<EmptyRoster size={100} />}
                    />
                ) : (
                    <>
                        <div className="list-row" style={{ color: 'var(--text-faint)' }}>
                            <span>Rank</span>
                            <span>Player</span>
                            <span className="hide-sm">Record</span>
                            <span className="hide-sm">Win rate</span>
                            <span>Elo</span>
                        </div>
                        {ranked.map((d) => (
                            <Link
                                key={d.id}
                                to={`/app/players/${d.id}`}
                                className={`list-row ${d.rank <= 3 ? `rank-${d.rank}` : ''}`}
                            >
                                <span className="num">#{d.rank}</span>
                                <strong>
                                    {d.name}
                                    {d.status === 'graduated' ? ' · Grad' : ''}
                                </strong>
                                <span className="hide-sm num">
                                    {d.played ? `${d.wins}–${d.losses}` : '—'}
                                </span>
                                <span className="hide-sm num">
                                    {d.winRate == null ? '—' : `${d.winRate.toFixed(1)}%`}
                                </span>
                                <span className="elo">{Math.round(d.elo)}</span>
                            </Link>
                        ))}
                    </>
                )}
            </Card>
        </div>
    );
}
