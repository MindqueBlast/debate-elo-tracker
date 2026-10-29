import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { rankDebaters, rankTeams, seasonLabel } from '../domain';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { EmptyRoster, ScalesMotif } from '../components/illustrations';
import { useAppData } from '../state/AppDataProvider';

export function RankingsPage() {
    const { debaters, teams, practiceRounds, season, activeIds } = useAppData();
    const [view, setView] = useState<'people' | 'teams'>('people');
    const [q, setQ] = useState('');
    // Active = competed in the latest season with results
    const [activeOnly, setActiveOnly] = useState(true);
    const [showDisbanded, setShowDisbanded] = useState(false);
    const ranked = useMemo(
        () =>
            rankDebaters(debaters, practiceRounds, {
                only: activeOnly ? activeIds : undefined,
                showGraduated: true,
                search: q,
            }),
        [debaters, practiceRounds, activeOnly, activeIds, q]
    );
    const rankedTeams = useMemo(
        () => rankTeams(teams, debaters, { showInactive: showDisbanded, search: q }),
        [teams, debaters, showDisbanded, q]
    );

    return (
        <div>
            <PageHeader
                kicker="Board"
                title="Rankings"
                illustration={<ScalesMotif size={72} tone="accent" />}
                actions={
                    <div className="segmented" role="group" aria-label="Rank">
                        <button
                            type="button"
                            aria-pressed={view === 'people'}
                            onClick={() => setView('people')}
                        >
                            Individuals
                        </button>
                        <button
                            type="button"
                            aria-pressed={view === 'teams'}
                            onClick={() => setView('teams')}
                        >
                            Teams
                        </button>
                    </div>
                }
            />
            <div className="toolbar">
                <input
                    className="input"
                    placeholder={view === 'people' ? 'Search people…' : 'Search teams or people…'}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                {view === 'people' ? (
                    <label className="row check" style={{ marginBottom: 0 }}>
                        <input
                            type="checkbox"
                            checked={activeOnly}
                            onChange={(e) => setActiveOnly(e.target.checked)}
                        />
                        Show active only{season ? ` (competed in ${seasonLabel(season)})` : ''}
                    </label>
                ) : (
                    <label className="row check" style={{ marginBottom: 0 }}>
                        <input
                            type="checkbox"
                            checked={showDisbanded}
                            onChange={(e) => setShowDisbanded(e.target.checked)}
                        />
                        Show disbanded teams
                    </label>
                )}
            </div>
            <Card>
                {view === 'people' ? (
                    ranked.length === 0 ? (
                        <EmptyState
                            title={q ? 'No matches' : 'No players'}
                            body={q ? 'Try a different name.' : 'The leaderboard fills in as the roster grows.'}
                            illustration={<EmptyRoster size={100} />}
                        />
                    ) : (
                        <>
                            <div className="list-row" style={{ color: 'var(--text-faint)' }}>
                                <span>Rank</span>
                                <span>Player</span>
                                <span className="hide-sm">Practice</span>
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
                                        {activeIds.has(d.id)
                                            ? ''
                                            : d.status === 'graduated'
                                              ? ' · Grad'
                                              : ' · Inactive'}
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
                    )
                ) : rankedTeams.length === 0 ? (
                    <EmptyState
                        title={q ? 'No matches' : 'No teams'}
                        body={q ? 'Try a different name.' : 'Save partnerships on the Players page.'}
                        illustration={<EmptyRoster size={100} />}
                    />
                ) : (
                    <>
                        <div className="list-row list-row--teams" style={{ color: 'var(--text-faint)' }}>
                            <span>Rank</span>
                            <span>Team</span>
                            <span className="hide-sm">Division</span>
                            <span className="hide-sm">Members</span>
                            <span>Elo</span>
                        </div>
                        {rankedTeams.map((r) => (
                            <div
                                key={r.team.id}
                                className={`list-row list-row--teams ${r.rank <= 3 && r.team.active ? `rank-${r.rank}` : ''}`}
                            >
                                <span className="num">#{r.rank}</span>
                                <strong>
                                    {r.name}
                                    {r.team.active ? '' : ' · Disbanded'}
                                </strong>
                                <span className="hide-sm">{r.team.division ?? '—'}</span>
                                <span className="hide-sm num">
                                    {r.members.map((m) => `${m.name} ${Math.round(m.elo)}`).join(' · ')}
                                </span>
                                <span className="elo">{Math.round(r.elo)}</span>
                            </div>
                        ))}
                        <p className="note" style={{ marginTop: 12 }}>
                            A team’s Elo is the average of its two people.
                        </p>
                    </>
                )}
            </Card>
        </div>
    );
}
