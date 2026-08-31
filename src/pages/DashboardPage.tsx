import { Link } from 'react-router-dom';
import { averageElo, buildEloSeries, rankDebaters } from '../domain';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Card, EmptyState, PageHeader, StatCard } from '../components/Card';
import { EloChart } from '../components/EloChart';
import { useAppData } from '../state/AppDataProvider';

export function DashboardPage() {
    const { debaters, practiceRounds, tournaments, loading, error } =
        useAppData();
    const ranked = rankDebaters(debaters, practiceRounds);
    const active = debaters.filter((d) => d.status === 'active');
    const avg = averageElo(active.map((d) => d.elo));
    const recentRounds = [...practiceRounds]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 6);
    const top = ranked[0];
    const series = top
        ? buildEloSeries({
              debaters,
              selectedId: top.id,
          })
        : null;
    const name = (id: string) =>
        debaters.find((d) => d.id === id)?.name ?? 'Unknown';

    if (error) {
        return <EmptyState title="Could not load data" body={error} />;
    }

    return (
        <div>
            <PageHeader kicker="Overview" title="Dashboard" />
            {loading && <p className="page-kicker">Refreshing…</p>}
            <div className="grid grid-4" style={{ marginBottom: 20 }}>
                <StatCard
                    label="Active roster"
                    value={<AnimatedNumber value={active.length} />}
                />
                <StatCard
                    label="Average Elo"
                    value={<AnimatedNumber value={Math.round(avg)} />}
                />
                <StatCard
                    label="Practice rounds"
                    value={<AnimatedNumber value={practiceRounds.length} />}
                />
                <StatCard
                    label="Tournaments"
                    value={<AnimatedNumber value={tournaments.length} />}
                />
            </div>
            <div className="grid grid-2">
                <Card>
                    <div className="card-title">Current top players</div>
                    {ranked.length === 0 ? (
                        <EmptyState
                            title="No players yet"
                            body="Add debaters to start the board."
                        />
                    ) : (
                        ranked.slice(0, 5).map((d) => (
                            <Link
                                key={d.id}
                                to={`/app/players/${d.id}`}
                                className={`list-row ${d.rank <= 3 ? `rank-${d.rank}` : ''}`}
                            >
                                <span className="num">#{d.rank}</span>
                                <strong>{d.name}</strong>
                                <span className="elo hide-sm">
                                    {Math.round(d.elo)}
                                </span>
                            </Link>
                        ))
                    )}
                </Card>
                <Card>
                    <div className="card-title">
                        {top ? `${top.name}'s Elo` : 'Elo trend'}
                    </div>
                    {series ? (
                        <EloChart
                            series={series.series}
                            yMin={series.yMin}
                            yMax={series.yMax}
                            isEmpty={series.isEmpty}
                        />
                    ) : (
                        <EmptyState
                            title="No graph yet"
                            body="Rankings will populate a trend once players exist."
                        />
                    )}
                </Card>
                <Card>
                    <div className="card-title">Recent practice</div>
                    {recentRounds.length === 0 ? (
                        <EmptyState
                            title="No matches"
                            body="Record a practice round to see it here."
                        />
                    ) : (
                        recentRounds.map((r) => (
                            <div key={r.id} className="match-row">
                                <span className="num">{r.date}</span>
                                <span>
                                    {name(r.winner_id)} def. {name(r.loser_id)}
                                </span>
                                <span className="delta-pos num">
                                    +{r.winner_change.toFixed(1)}
                                </span>
                            </div>
                        ))
                    )}
                </Card>
                <Card>
                    <div className="card-title">Latest tournaments</div>
                    {tournaments.length === 0 ? (
                        <EmptyState
                            title="No tournaments"
                            body="Tournament results will appear after they are recorded."
                        />
                    ) : (
                        [...tournaments]
                            .sort((a, b) => (a.date < b.date ? 1 : -1))
                            .slice(0, 5)
                            .map((t) => (
                                <div key={t.id} className="match-row">
                                    <span className="num">{t.date}</span>
                                    <strong>{t.name || 'Unnamed tournament'}</strong>
                                </div>
                            ))
                    )}
                </Card>
            </div>
        </div>
    );
}
