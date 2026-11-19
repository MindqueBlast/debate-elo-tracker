import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { rankDebaters, rankTeams } from '../domain';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { useAppData } from '../state/AppDataProvider';

export function RankingsPage() {
    const { debaters, teams, practiceRounds } = useAppData();
    const [view, setView] = useState<'people' | 'teams'>('people');
    const [q, setQ] = useState('');
    // The main board shows everyone still on the team; graduates only when asked for
    const [showGrads, setShowGrads] = useState(false);
    const [showDisbanded, setShowDisbanded] = useState(false);
    const ranked = useMemo(
        () =>
            rankDebaters(debaters, practiceRounds, {
                showGraduated: showGrads,
                search: q,
            }),
        [debaters, practiceRounds, showGrads, q]
    );
    // practice columns only once someone has recorded a practice round
    const showPractice = practiceRounds.length > 0;
    const rowClass = showPractice ? 'list-row' : 'list-row list-row--compact';
    const rankedTeams = useMemo(
        () => rankTeams(teams, debaters, { showInactive: showDisbanded, search: q }),
        [teams, debaters, showDisbanded, q]
    );

    return (
        <div>
            <PageHeader
                title="Rankings"
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
                            checked={showGrads}
                            onChange={(e) => setShowGrads(e.target.checked)}
                        />
                        Show graduates
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
                        />
                    ) : (
                        <>
                            <div className={`${rowClass} list-head`}>
                                <span>Rank</span>
                                <span>Player</span>
                                {showPractice && <span className="hide-sm">Practice</span>}
                                {showPractice && <span className="hide-sm">Win rate</span>}
                                <span>Elo</span>
                            </div>
                            {ranked.map((d) => (
                                <Link
                                    key={d.id}
                                    to={`/app/players/${d.id}`}
                                    className={`${rowClass} ${d.rank <= 3 ? `rank-${d.rank}` : ''}`}
                                >
                                    <span className="num">#{d.rank}</span>
                                    <span className="name-cell">
                                        <strong>{d.name}</strong>
                                        {d.status === 'graduated' && <span className="pill">Grad</span>}
                                    </span>
                                    {showPractice && (
                                        <span className="hide-sm num">
                                            {d.played ? `${d.wins} won, ${d.losses} lost` : 'None'}
                                        </span>
                                    )}
                                    {showPractice && (
                                        <span className="hide-sm num">
                                            {d.winRate == null ? '' : `${d.winRate.toFixed(1)}%`}
                                        </span>
                                    )}
                                    <span className="elo">{Math.round(d.elo)}</span>
                                </Link>
                            ))}
                        </>
                    )
                ) : rankedTeams.length === 0 ? (
                    <EmptyState
                        title={q ? 'No matches' : 'No teams'}
                        body={q ? 'Try a different name.' : 'Save partnerships on the Players page.'}
                    />
                ) : (
                    <>
                        <div className="list-row list-row--teams list-head">
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
                                <span className="name-cell">
                                    <strong>{r.name}</strong>
                                    {!r.team.active && <span className="pill">Disbanded</span>}
                                </span>
                                <span className="hide-sm">{r.team.division ?? ''}</span>
                                <span className="hide-sm num">
                                    {r.members.map((m) => `${m.name} ${Math.round(m.elo)}`).join(', ')}
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
