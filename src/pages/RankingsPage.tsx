import { useMemo, useState } from 'react';
import { rankDebaters, rankTeams } from '../domain';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { Segmented } from '../components/Segmented';
import { Standings } from '../components/Standings';
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
    const rankedTeams = useMemo(
        () => rankTeams(teams, debaters, { showInactive: showDisbanded, search: q }),
        [teams, debaters, showDisbanded, q]
    );

    return (
        <div>
            <PageHeader
                title="Rankings"
                sub={
                    q.trim()
                        ? `${view === 'people' ? ranked.length : rankedTeams.length} matching “${q.trim()}”.`
                        : view === 'people'
                          ? `${ranked.length} ${showGrads ? 'people, graduates included' : 'on the team'}, highest Elo first.`
                          : `${rankedTeams.length} ${showDisbanded ? 'teams, disbanded included' : 'teams'}, by the average of both partners.`
                }
                actions={
                    <Segmented
                        label="Rank"
                        value={view}
                        onChange={setView}
                        options={[
                            { value: 'people', label: 'Individuals' },
                            { value: 'teams', label: 'Teams' },
                        ]}
                    />
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
                        <Standings
                            label="Individual rankings"
                            extraHeads={showPractice ? ['Practice', 'Win rate'] : []}
                            rows={ranked.map((d) => ({
                                key: d.id,
                                rank: d.rank,
                                name: d.name,
                                elo: d.elo,
                                to: `/app/players/${d.id}`,
                                tags: d.status === 'graduated' ? <span className="pill">Grad</span> : undefined,
                                extras: showPractice
                                    ? [
                                          d.played ? `${d.wins} won, ${d.losses} lost` : 'None',
                                          d.winRate == null ? '' : `${d.winRate.toFixed(1)}%`,
                                      ]
                                    : undefined,
                            }))}
                        />
                    )
                ) : rankedTeams.length === 0 ? (
                    <EmptyState
                        title={q ? 'No matches' : 'No teams'}
                        body={q ? 'Try a different name.' : 'Save partnerships on the Players page.'}
                    />
                ) : (
                    <>
                        <Standings
                            label="Team rankings"
                            nameHead="Team"
                            extraHeads={['Division', 'Members']}
                            rows={rankedTeams.map((r) => ({
                                key: r.team.id,
                                rank: r.rank,
                                name: r.name,
                                elo: r.elo,
                                medal: r.team.active,
                                tags: !r.team.active ? <span className="pill">Disbanded</span> : undefined,
                                extras: [
                                    r.team.division ?? '',
                                    r.members.map((m) => `${m.name} ${Math.round(m.elo)}`).join(', '),
                                ],
                            }))}
                        />
                        <p className="note" style={{ marginTop: 12 }}>
                            A team’s Elo is the average of its two people.
                        </p>
                    </>
                )}
            </Card>
        </div>
    );
}
