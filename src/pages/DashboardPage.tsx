import { Link } from 'react-router-dom';
import {
    averageElo,
    buildEloSeries,
    lookup,
    pairingLabel,
    rankDebaters,
    rankTeams,
    seasonLabel,
} from '../domain';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Card, EmptyState, PageHeader, StatCard } from '../components/Card';
import { EloChart } from '../components/EloChart';
import { useAppData } from '../state/AppDataProvider';

export function DashboardPage() {
    const { debaters, teams, practiceRounds, tournaments, season, activeIds, loading, error } =
        useAppData();
    // Active = competed in the latest season with results
    const ranked = rankDebaters(debaters, practiceRounds, { only: activeIds });
    const topTeams = rankTeams(teams, debaters).slice(0, 5);
    const byId = lookup(debaters);
    const active = debaters.filter((d) => activeIds.has(d.id));
    const avg = averageElo(active.map((d) => d.elo));
    // practice panels only once someone has recorded a practice round
    const hasPractice = practiceRounds.length > 0;
    const recentRounds = [...practiceRounds]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 6);
    const top = ranked[0];
    const series = top
        ? buildEloSeries({
              debaters,
              selectedId: top.id,
              tournaments,
              practiceRounds,
          })
        : null;

    if (error) {
        return <EmptyState title="Could not load data" body={error} />;
    }

    return (
        <div>
            <PageHeader title="Dashboard" />
            {loading && <p className="note">Refreshing…</p>}
            <div className={`grid ${hasPractice ? 'grid-4' : 'grid-3'} stat-grid`}>
                <StatCard
                    label={season ? `Active in ${seasonLabel(season)}` : 'Active people'}
                    value={<AnimatedNumber value={active.length} />}
                />
                <StatCard
                    label="Average Elo"
                    value={<AnimatedNumber value={Math.round(avg)} />}
                />
                {hasPractice && (
                    <StatCard
                        label="Practice rounds"
                        value={<AnimatedNumber value={practiceRounds.length} />}
                    />
                )}
                <StatCard
                    label="Tournaments"
                    value={<AnimatedNumber value={tournaments.length} />}
                />
            </div>
            <div className="grid grid-2">
                <Card>
                    <div className="card-title">Top individuals</div>
                    {ranked.length === 0 ? (
                        <EmptyState
                            title="No players yet"
                            body="Add debaters to start the board."
                        />
                    ) : (
                        ranked.slice(0, 10).map((d) => (
                            <Link
                                key={d.id}
                                to={`/app/players/${d.id}`}
                                className={`list-row list-row--compact ${d.rank <= 3 ? `rank-${d.rank}` : ''}`}
                            >
                                <span className="num">#{d.rank}</span>
                                <strong>{d.name}</strong>
                                <span className="elo">
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
                    <div className="card-title">Top teams</div>
                    {topTeams.length === 0 ? (
                        <EmptyState
                            title="No teams yet"
                            body="Save partnerships on the Players page."
                        />
                    ) : (
                        topTeams.map((r) => (
                            <div
                                key={r.team.id}
                                className={`list-row list-row--compact ${r.rank <= 3 ? `rank-${r.rank}` : ''}`}
                            >
                                <span className="num">#{r.rank}</span>
                                <strong>{r.name}</strong>
                                <span className="elo">{Math.round(r.elo)}</span>
                            </div>
                        ))
                    )}
                </Card>
                {hasPractice && (
                    <Card>
                        <div className="card-title">Recent practice</div>
                        {recentRounds.map((r) => (
                            <div key={r.id} className="match-row">
                                <span className="num">{r.date}</span>
                                <span>
                                    {pairingLabel([r.winner_id, r.winner_partner_id], byId)} def.{' '}
                                    {pairingLabel([r.loser_id, r.loser_partner_id], byId)}
                                </span>
                                <span className="delta-pos num" style={{ whiteSpace: 'nowrap' }}>
                                    {[r.winner_change, r.winner_partner_id ? (r.winner_partner_change ?? r.winner_change) : null]
                                        .filter((x): x is number => x !== null)
                                        .map((x) => `+${x.toFixed(1)}`)
                                        .join(' / ')}
                                </span>
                            </div>
                        ))}
                    </Card>
                )}
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
