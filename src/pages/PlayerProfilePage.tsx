import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    buildEloSeries,
    eloStdDev,
    entryChangeFor,
    lookup,
    pairingLabel,
    peakElo,
    practiceChangeFor,
    practiceRecord,
    practiceSide,
    rankDebaters,
    seasonLabel,
    teamName,
    type Division,
} from '../domain';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Button } from '../components/Button';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { EloChart } from '../components/EloChart';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../state/AppDataProvider';

const SHORT: Record<Division, string> = { Varsity: 'V', JV: 'JV', Novice: 'N' };

export function PlayerProfilePage() {
    const { id } = useParams();
    const { isAdmin } = useAuth();
    const { debaters, teams, practiceRounds, tournaments, season, activeIds } = useAppData();
    const isActive = !!id && activeIds.has(id);
    const byId = useMemo(() => lookup(debaters), [debaters]);
    const debater = id ? byId.get(id) : undefined;
    const [shownResults, setShownResults] = useState(8);

    // Ranked among this season's active people (or everyone, for someone who isn't active)
    const ranked = useMemo(
        () =>
            rankDebaters(debaters, practiceRounds, isActive ? { only: activeIds } : { showGraduated: true }),
        [debaters, practiceRounds, isActive, activeIds]
    );
    const rank = ranked.find((d) => d.id === id)?.rank;
    const record = debater ? practiceRecord(debater.id, practiceRounds) : null;
    const series = useMemo(
        () =>
            debater
                ? buildEloSeries({ debaters, selectedId: debater.id, tournaments, practiceRounds })
                : null,
        [debater, debaters, tournaments, practiceRounds]
    );

    const results = useMemo(() => {
        if (!id) return [];
        const rows: {
            key: string;
            date: string;
            name: string;
            partnerId: string | null;
            division: Division;
            raw: number;
            change: number;
        }[] = [];
        for (const t of tournaments) {
            for (const p of t.tournament_participants) {
                if (p.debater_id !== id && p.partner_id !== id) continue;
                rows.push({
                    key: `${t.id}-${p.id ?? p.debater_id}`,
                    date: t.date,
                    name: t.name || 'Unnamed tournament',
                    partnerId: (p.debater_id === id ? p.partner_id : p.debater_id) ?? null,
                    division: p.division,
                    raw: p.raw_wins,
                    change: entryChangeFor(p, id),
                });
            }
        }
        return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }, [tournaments, id]);

    const partners = useMemo(() => {
        const counts = new Map<string, number>();
        for (const r of results) {
            if (r.partnerId) counts.set(r.partnerId, (counts.get(r.partnerId) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    }, [results]);

    const myTeams = useMemo(
        () =>
            teams
                .filter((t) => t.member1_id === id || t.member2_id === id)
                .sort((a, b) => Number(b.active) - Number(a.active)),
        [teams, id]
    );

    const recent = practiceRounds
        .filter((r) => id && practiceSide(r, id) !== null)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, 8);

    if (!debater || !id) {
        return (
            <EmptyState
                title="Player not found"
                body="This person is missing or the link is invalid."
            />
        );
    }

    const sd = eloStdDev(debater.history);

    return (
        <div>
            <PageHeader
                title={debater.name}
                actions={
                    isAdmin ? (
                        <Link to="/app/players" className="btn btn-secondary btn-sm">
                            All players
                        </Link>
                    ) : (
                        <Link to="/app/rankings" className="btn btn-secondary btn-sm">
                            Rankings
                        </Link>
                    )
                }
            />
            <div className="grid grid-2">
                <Card className="profile-hero-card">
                    <div className="stat-label">Current Elo</div>
                    <div className="profile-elo">
                        <AnimatedNumber value={Math.round(debater.elo)} />
                    </div>
                    <div className="row" style={{ marginTop: 16 }}>
                        {rank != null && <span className="pill">Rank #{rank}</span>}
                        {debater.division && <span className="pill">{debater.division}</span>}
                        {debater.class_year != null && (
                            <span className="pill">Class of {debater.class_year}</span>
                        )}
                        <span className="pill">
                            {isActive
                                ? `Active ${seasonLabel(season)}`
                                : debater.status === 'graduated'
                                  ? 'graduated'
                                  : 'inactive'}
                        </span>
                        {practiceRounds.length > 0 && (
                            <span className="pill">
                                {record && record.played
                                    ? `Practice ${record.wins} won, ${record.losses} lost (${record.winRate?.toFixed(1)}%)`
                                    : 'No practice rounds'}
                            </span>
                        )}
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
                            <div className="elo">{results.length}</div>
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
                    {(myTeams.length > 0 || partners.length > 0) && (
                        <div style={{ marginTop: 24 }}>
                            {myTeams.length > 0 && (
                                <>
                                    <div className="stat-label">Teams</div>
                                    <div className="chips" style={{ margin: '6px 0 12px' }}>
                                        {myTeams.map((t) => (
                                            <span key={t.id} className="pill">
                                                {teamName(t, byId)}
                                                {t.active ? '' : ' (past)'}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}
                            {partners.length > 0 && (
                                <>
                                    <div className="stat-label">Tournament partners</div>
                                    <div className="chips" style={{ marginTop: 6 }}>
                                        {partners.map(([pid, count]) => (
                                            <Link key={pid} to={`/app/players/${pid}`} className="pill">
                                                {byId.get(pid)?.name ?? 'Unknown'} ×{count}
                                            </Link>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
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
            <div className={`grid ${practiceRounds.length > 0 ? 'grid-2' : ''}`} style={{ marginTop: 16 }}>
                <Card>
                    <div className="card-title">Tournament results</div>
                    {results.length === 0 ? (
                        <EmptyState
                            title="No tournaments yet"
                            body="Results show up here once they’re recorded."
                        />
                    ) : (
                        <>
                            {results.slice(0, shownResults).map((r) => (
                                <div key={r.key} className="match-row">
                                    <span className="num">{r.date}</span>
                                    <span>
                                        <strong>{r.name}</strong>
                                        <div className="note">
                                            {SHORT[r.division]}{' '}
                                            {r.partnerId
                                                ? `with ${byId.get(r.partnerId)?.name ?? 'Unknown'}`
                                                : 'partner not on record'}
                                            , raw {r.raw}
                                        </div>
                                    </span>
                                    <span className={`num ${r.change >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                                        {r.change >= 0 ? '+' : ''}
                                        {r.change.toFixed(1)}
                                    </span>
                                </div>
                            ))}
                            {results.length > shownResults && (
                                <div className="pagination">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setShownResults((n) => n + 12)}
                                    >
                                        Show more ({results.length - shownResults} left)
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </Card>
                {/* practice only once someone has recorded a practice round */}
                {practiceRounds.length > 0 && (
                    <Card>
                        <div className="card-title">Recent practice</div>
                        {recent.length === 0 ? (
                            <EmptyState
                                title="No practice rounds"
                                body="This person hasn’t been in a recorded practice round."
                            />
                        ) : (
                            recent.map((r) => {
                                const won = practiceSide(r, id) === 'won';
                                const mine = won
                                    ? [r.winner_id, r.winner_partner_id]
                                    : [r.loser_id, r.loser_partner_id];
                                const theirs = won
                                    ? [r.loser_id, r.loser_partner_id]
                                    : [r.winner_id, r.winner_partner_id];
                                const partner = mine.find((x) => x && x !== id);
                                const delta = practiceChangeFor(r, id);
                                return (
                                    <div key={r.id} className="match-row">
                                        <span className="num">{r.date}</span>
                                        <span>
                                            <span className={won ? 'pill pill-win' : 'pill pill-loss'}>
                                                {won ? 'Win' : 'Loss'}
                                            </span>{' '}
                                            vs {pairingLabel(theirs, byId)}
                                            {partner && (
                                                <span className="note">
                                                    {' '}
                                                    with {byId.get(partner)?.name ?? 'Unknown'}
                                                </span>
                                            )}
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
                )}
            </div>
        </div>
    );
}
