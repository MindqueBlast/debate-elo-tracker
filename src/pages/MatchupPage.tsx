import { useMemo, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    entryChangeFor,
    lookup,
    rankDebaters,
    rankTeams,
    winChance,
    type Debater,
    type TournamentParticipant,
} from '../domain';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { useAppData } from '../state/AppDataProvider';

interface Side {
    key: string;
    name: string;
    elo: number;
    rank: number;
    /** "Team" or "Debater", with the rank it holds on that board. */
    board: string;
    members: Debater[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`;

/**
 * Two sides face to face: their ratings, the chance the ratings give each, and
 * how they did at the tournaments they both entered.
 */
export function MatchupPage() {
    const { debaters, teams, tournaments, practiceRounds, loading } = useAppData();
    const [params, setParams] = useSearchParams();
    const byId = useMemo(() => lookup(debaters), [debaters]);
    const rankedTeams = useMemo(() => rankTeams(teams, debaters), [teams, debaters]);
    const rankedPeople = useMemo(() => rankDebaters(debaters, practiceRounds, {}), [debaters, practiceRounds]);

    const sides = useMemo(() => {
        const map = new Map<string, Side>();
        for (const t of rankedTeams)
            map.set(`team:${t.team.id}`, {
                key: `team:${t.team.id}`,
                name: t.name,
                elo: t.elo,
                rank: t.rank,
                board: `Team #${t.rank}`,
                members: t.members.map((m) => byId.get(m.id)).filter((d): d is Debater => !!d),
            });
        for (const d of rankedPeople)
            map.set(`person:${d.id}`, {
                key: `person:${d.id}`,
                name: d.name,
                elo: d.elo,
                rank: d.rank,
                board: `Debater #${d.rank}`,
                members: [byId.get(d.id)!].filter(Boolean),
            });
        return map;
    }, [rankedTeams, rankedPeople, byId]);

    // the top two teams face off until someone picks
    const fallbackA = rankedTeams[0] ? `team:${rankedTeams[0].team.id}` : rankedPeople[0] ? `person:${rankedPeople[0].id}` : '';
    const fallbackB = rankedTeams[1] ? `team:${rankedTeams[1].team.id}` : rankedPeople[1] ? `person:${rankedPeople[1].id}` : '';
    const aKey = sides.has(params.get('a') ?? '') ? params.get('a')! : fallbackA;
    const bKey = sides.has(params.get('b') ?? '') ? params.get('b')! : fallbackB;
    const a = sides.get(aKey);
    const b = sides.get(bKey);

    const pick = (which: 'a' | 'b', key: string) => {
        const next = new URLSearchParams(params);
        next.set('a', which === 'a' ? key : aKey);
        next.set('b', which === 'b' ? key : bKey);
        setParams(next, { replace: true });
    };
    const swap = () => setParams(new URLSearchParams({ a: bKey, b: aKey }), { replace: true });

    // an entry belongs to a side when it has every one of the side's people in it
    const entryOf = (side: Side, ps: TournamentParticipant[]) =>
        ps.find((p) => side.members.every((m) => p.debater_id === m.id || p.partner_id === m.id));
    const changeOf = (side: Side, p: TournamentParticipant) =>
        side.members.reduce((sum, m) => sum + entryChangeFor(p, m.id), 0) / side.members.length;

    const shared = useMemo(() => {
        if (!a || !b || a.key === b.key) return [];
        return tournaments
            .map((t) => {
                const ea = entryOf(a, t.tournament_participants);
                const eb = entryOf(b, t.tournament_participants);
                return ea && eb && ea !== eb ? { t, ea, eb } : null;
            })
            .filter((x): x is NonNullable<typeof x> => !!x)
            .sort((x, y) => (x.t.date < y.t.date ? 1 : -1));
    }, [a, b, tournaments]);

    const options = (
        <>
            <optgroup label="Teams">
                {rankedTeams.map((t) => (
                    <option key={t.team.id} value={`team:${t.team.id}`}>
                        {t.name} ({Math.round(t.elo)})
                    </option>
                ))}
            </optgroup>
            <optgroup label="Debaters">
                {rankedPeople.map((d) => (
                    <option key={d.id} value={`person:${d.id}`}>
                        {d.name} ({Math.round(d.elo)})
                    </option>
                ))}
            </optgroup>
        </>
    );

    if (!a || !b) {
        return (
            <div>
                <PageHeader title="Matchup" />
                <EmptyState
                    title={loading ? 'Loading the board' : 'Nobody to match up'}
                    body={loading ? 'One moment.' : 'Add debaters and teams first.'}
                />
            </div>
        );
    }

    const same = a.key === b.key;
    const chance = winChance(a.elo, b.elo);
    const aheadA = shared.filter((s) => s.ea.raw_wins > s.eb.raw_wins).length;
    const aheadB = shared.filter((s) => s.eb.raw_wins > s.ea.raw_wins).length;

    return (
        <div>
            <PageHeader title="Matchup" sub="Pick any two teams or debaters to see who the ratings favour." />
            <div className="matchup-pickers">
                <div className="field">
                    <label htmlFor="matchupA">Side one</label>
                    <select id="matchupA" value={aKey} onChange={(e) => pick('a', e.target.value)}>
                        {options}
                    </select>
                </div>
                <button type="button" className="btn btn-secondary matchup-swap" onClick={swap} aria-label="Swap sides">
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M2 5h10m0 0-3-3m3 3-3 3M14 11H4m0 0 3-3m-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                    Swap
                </button>
                <div className="field">
                    <label htmlFor="matchupB">Side two</label>
                    <select id="matchupB" value={bKey} onChange={(e) => pick('b', e.target.value)}>
                        {options}
                    </select>
                </div>
            </div>

            <section className="faceoff" aria-label={`${a.name} against ${b.name}`}>
                {[a, b].map((s, i) => (
                    <div key={i} className={`faceoff__side faceoff__side--${i === 0 ? 'a' : 'b'}`}>
                        <span className="faceoff__board">{s.board}</span>
                        <h2 className="faceoff__name">{s.name}</h2>
                        <div className="faceoff__elo figure">
                            <AnimatedNumber value={Math.round(s.elo)} duration={500} />
                        </div>
                        <div className="faceoff__members">
                            {s.members.length > 1
                                ? s.members.map((m) => (
                                      <Link key={m.id} to={`/app/players/${m.id}`}>
                                          {m.name} {Math.round(m.elo)}
                                      </Link>
                                  ))
                                : s.members[0] && <Link to={`/app/players/${s.members[0].id}`}>Profile</Link>}
                        </div>
                    </div>
                ))}
                <span className="faceoff__vs" aria-hidden="true">
                    vs
                </span>
            </section>

            {same ? (
                <p className="note matchup-note">Pick two different sides.</p>
            ) : (
                <>
                    <div
                        className="chance"
                        role="img"
                        aria-label={`${a.name} ${pct(chance)}, ${b.name} ${pct(1 - chance)}`}
                        style={{ '--chance': chance } as CSSProperties}
                    >
                        <span className="chance__a">
                            <b className="figure">{pct(chance)}</b>
                        </span>
                        <span className="chance__b">
                            <b className="figure">{pct(1 - chance)}</b>
                        </span>
                    </div>
                </>
            )}

            {!same && (
                <Card className="matchup-shared">
                    <div className="card-title">
                        At the same tournaments
                        {shared.length > 0 && (
                            <span className="card-title__meta">
                                {a.name} ahead {aheadA}, {b.name} ahead {aheadB}, by raw wins
                            </span>
                        )}
                    </div>
                    {shared.length === 0 ? (
                        <EmptyState
                            title="Never at the same tournament"
                            body="Once both sides enter the same tournament, their results line up here."
                        />
                    ) : (
                        <div className="shared">
                            <div className="shared__row shared__row--head" aria-hidden="true">
                                <span>Tournament</span>
                                <span>{a.name}</span>
                                <span>{b.name}</span>
                            </div>
                            {shared.map(({ t, ea, eb }) => {
                                const ca = changeOf(a, ea);
                                const cb = changeOf(b, eb);
                                return (
                                    <div key={t.id} className="shared__row">
                                        <span className="shared__t">
                                            <strong>{t.name || 'Unnamed tournament'}</strong>
                                            <span className="num muted">{t.date}</span>
                                        </span>
                                        <span className={`shared__res${ea.raw_wins > eb.raw_wins ? ' is-ahead' : ''}`}>
                                            <span className="sr-only">{a.name}: </span>
                                            raw {ea.raw_wins}{' '}
                                            <span className={ca >= 0 ? 'delta-pos' : 'delta-neg'}>{signed(ca)}</span>
                                        </span>
                                        <span className={`shared__res${eb.raw_wins > ea.raw_wins ? ' is-ahead' : ''}`}>
                                            <span className="sr-only">{b.name}: </span>
                                            raw {eb.raw_wins}{' '}
                                            <span className={cb >= 0 ? 'delta-pos' : 'delta-neg'}>{signed(cb)}</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
