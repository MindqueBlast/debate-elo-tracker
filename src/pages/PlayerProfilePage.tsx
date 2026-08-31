import { Link, useParams } from 'react-router-dom';
import {
    buildEloSeries,
    eloStdDev,
    peakElo,
    practiceRecord,
    rankDebaters,
} from '../domain';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { EloChart } from '../components/EloChart';
import { useAppData } from '../state/AppDataProvider';

export function PlayerProfilePage() {
    const { id } = useParams();
    const { debaters, practiceRounds, tournaments } = useAppData();
    const debater = debaters.find((d) => d.id === id);
    const ranked = rankDebaters(debaters, practiceRounds, {
        showGraduated: true,
    });
    const rank = ranked.find((d) => d.id === id)?.rank;
    const record = debater
        ? practiceRecord(debater.id, practiceRounds)
        : null;
    const series = debater
        ? buildEloSeries({ debaters, selectedId: debater.id })
        : null;
    const entered = tournaments.filter((t) =>
        t.tournament_participants.some((p) => p.debater_id === id)
    ).length;
    const recent = practiceRounds
        .filter((r) => r.winner_id === id || r.loser_id === id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 8);
    const nameOf = (pid: string) =>
        debaters.find((d) => d.id === pid)?.name ?? 'Unknown';

    if (!debater) {
        return (
            <EmptyState
                title="Player not found"
                body="This debater is missing or the link is invalid."
            />
        );
    }

    const sd = eloStdDev(debater.history);

    return (
        <div>
            <PageHeader
                kicker="Profile"
                title={debater.name}
                actions={
                    <Link to="/app/players" className="btn btn-secondary btn-sm">
                        All players
                    </Link>
                }
            />
            <div className="grid grid-2">
                <Card>
                    <div className="page-kicker">Current Elo</div>
                    <div className="profile-elo">
                        <AnimatedNumber value={Math.round(debater.elo)} />
                    </div>
                    <div className="row" style={{ marginTop: 16 }}>
                        <span className="pill">Rank #{rank ?? '—'}</span>
                        <span className="pill">{debater.status}</span>
                        <span className="pill">
                            {record && record.played
                                ? `${record.wins}–${record.losses} (${record.winRate?.toFixed(1)}%)`
                                : 'PR winrate N/A'}
                        </span>
                    </div>
                    <div className="grid grid-2" style={{ marginTop: 24 }}>
                        <div>
                            <div className="stat-label">Peak Elo</div>
                            <div className="elo">
                                {Math.round(peakElo(debater.history, debater.elo))}
                            </div>
                        </div>
                        <div>
                            <div className="stat-label">Tournaments</div>
                            <div className="elo">{entered}</div>
                        </div>
                        <div>
                            <div className="stat-label">Graduation</div>
                            <div>{debater.graduation_date || 'N/A'}</div>
                        </div>
                        <div>
                            <div className="stat-label">Consistency (SD)</div>
                            <div>{sd == null ? 'N/A' : sd.toFixed(1)}</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div className="card-title">Elo history</div>
                    {series && (
                        <EloChart
                            series={series.series}
                            yMin={series.yMin}
                            yMax={series.yMax}
                            isEmpty={series.isEmpty}
                        />
                    )}
                </Card>
            </div>
            <Card style={{ marginTop: 16 }}>
                <div className="card-title">Recent practice</div>
                {recent.length === 0 ? (
                    <EmptyState
                        title="No practice rounds"
                        body="This debater has not appeared in a recorded practice round."
                    />
                ) : (
                    recent.map((r) => {
                        const won = r.winner_id === id;
                        const opp = won ? r.loser_id : r.winner_id;
                        const delta = won ? r.winner_change : r.loser_change;
                        return (
                            <div key={r.id} className="match-row">
                                <span className="num">{r.date}</span>
                                <span>
                                    <span className={won ? 'pill pill-win' : 'pill pill-loss'}>
                                        {won ? 'Win' : 'Loss'}
                                    </span>{' '}
                                    vs {nameOf(opp)}
                                </span>
                                <span className={delta >= 0 ? 'delta-pos' : 'delta-neg'}>
                                    {delta >= 0 ? '+' : ''}
                                    {delta.toFixed(1)}
                                </span>
                            </div>
                        );
                    })
                )}
            </Card>
        </div>
    );
}
