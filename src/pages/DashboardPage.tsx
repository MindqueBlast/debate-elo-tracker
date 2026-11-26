import { Link } from 'react-router-dom';
import {
    atPersonalBest,
    averageElo,
    buildEloSeries,
    seasonLabel,
    seasonMovers,
    lookup,
    pairingLabel,
    rankDebaters,
    rankTeams,
} from '../domain';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Card, EmptyState, PageHeader, StatCard } from '../components/Card';
import { EloChart } from '../components/EloChart';
import { Standings } from '../components/Standings';
import { useAppData } from '../state/AppDataProvider';

export function DashboardPage() {
    const { debaters, teams, practiceRounds, tournaments, activeIds, season, loading, error } =
        useAppData();
    // this season so far: who climbed most, and who is at their best right now
    const climbers = season
        ? seasonMovers(debaters, activeIds, season)
              .filter((m) => m.change > 0.05)
              .slice(0, 5)
        : [];
    const atBest = atPersonalBest(debaters, activeIds).slice(0, 5);
    // Active = competed in the latest season with results
    const ranked = rankDebaters(debaters, practiceRounds, { only: activeIds });
    const topTeams = rankTeams(teams, debaters).slice(0, 5);
    const byId = lookup(debaters);
    const active = debaters.filter((d) => activeIds.has(d.id));
    const avg = averageElo(active.map((d) => d.elo));
    // everyone still on the team, the same people Rankings lists
    const onTeam = debaters.filter((d) => d.status !== 'graduated').length;
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
            <PageHeader
                title="Dashboard"
                sub={loading ? 'Refreshing the board…' : 'Where the team stands today.'}
            />
            <div className={`grid ${hasPractice ? 'grid-4' : 'grid-3'} stat-grid`}>
                <StatCard label="Total" value={<AnimatedNumber value={onTeam} duration={700} />} />
                <StatCard
                    label="Average Elo"
                    value={<AnimatedNumber value={Math.round(avg)} duration={700} />}
                />
                {hasPractice && (
                    <StatCard
                        label="Practice rounds"
                        value={<AnimatedNumber value={practiceRounds.length} duration={700} />}
                    />
                )}
                <StatCard
                    label="Tournaments"
                    value={<AnimatedNumber value={tournaments.length} duration={700} />}
                />
            </div>
            <div className="grid grid-2">
                <Card>
                    <div className="card-title">
                        Top individuals
                        <Link to="/app/rankings" className="card-title__meta">
                            Full rankings
                        </Link>
                    </div>
                    {ranked.length === 0 ? (
                        <EmptyState
                            title="No players yet"
                            body="Add debaters to start the board."
                        />
                    ) : (
                        <Standings
                            label="Top ten individuals"
                            head={false}
                            rows={ranked.slice(0, 10).map((d) => ({
                                key: d.id,
                                rank: d.rank,
                                name: d.name,
                                elo: d.elo,
                                to: `/app/players/${d.id}`,
                            }))}
                        />
                    )}
                </Card>
                <Card>
                    <div className="card-title">
                        {top ? `${top.name}’s Elo` : 'Elo trend'}
                        {top && (
                            <Link to={`/app/players/${top.id}`} className="card-title__meta">
                                Profile
                            </Link>
                        )}
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
                        <Standings
                            label="Top five teams"
                            head={false}
                            rows={topTeams.map((r) => ({
                                key: r.team.id,
                                rank: r.rank,
                                name: r.name,
                                elo: r.elo,
                            }))}
                        />
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
                                <Link key={t.id} to="/app/matches" className="match-row match-row--link">
                                    <span className="num">{t.date}</span>
                                    <strong>{t.name || 'Unnamed tournament'}</strong>
                                    <span className="match-row__count num">
                                        {t.tournament_participants.length} {t.tournament_participants.length === 1 ? 'entry' : 'entries'}
                                    </span>
                                </Link>
                            ))
                    )}
                </Card>
                {(climbers.length > 0 || atBest.length > 0) && (
                    <Card className="season-card">
                        <div className="card-title">
                            This season
                            <span className="card-title__meta">{seasonLabel(season)}, active debaters</span>
                        </div>
                        <div className="season-card__cols">
                            <div>
                                <h3 className="season-card__head">Biggest climbs</h3>
                                {climbers.length === 0 ? (
                                    <p className="note">Nobody has climbed yet this season.</p>
                                ) : (
                                    <ol className="movers">
                                        {climbers.map((m) => (
                                            <li key={m.id}>
                                                <Link to={`/app/players/${m.id}`} className="mover">
                                                    <strong>{m.name}</strong>
                                                    <span className="mover__path num">
                                                        {Math.round(m.from)} to {Math.round(m.to)}
                                                    </span>
                                                    <span className="delta delta-pos">+{Math.round(m.change)}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                            <div>
                                <h3 className="season-card__head">At a personal best</h3>
                                {atBest.length === 0 ? (
                                    <p className="note">Nobody is at their peak right now.</p>
                                ) : (
                                    <ol className="movers">
                                        {atBest.map((d) => (
                                            <li key={d.id}>
                                                <Link to={`/app/players/${d.id}`} className="mover">
                                                    <strong>{d.name}</strong>
                                                    <span className="mover__path">Peak today</span>
                                                    <span className="delta">{Math.round(d.elo)}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
