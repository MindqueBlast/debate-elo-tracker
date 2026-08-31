import { useMemo, useState } from 'react';
import {
    calculatePracticeElo,
    getLocalDateString,
    type Debater,
    type Division,
} from '../domain';
import {
    deletePracticeRound,
    deleteTournament,
    MutationError,
    recordPracticeRound,
    recordTournament,
    type DraftParticipant,
} from '../data/mutations';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { useAppData } from '../state/AppDataProvider';
import { useToast } from '../state/ToastProvider';

const PAGE = 10;

export function MatchesPage() {
    const { isAdmin } = useAuth();
    const { debaters, practiceRounds, tournaments, refresh } = useAppData();
    const toast = useToast();
    const active = debaters.filter((d) => d.status === 'active');
    const nameOf = (id: string) =>
        debaters.find((d) => d.id === id)?.name ?? 'Unknown';

    const [winnerId, setWinnerId] = useState('');
    const [loserId, setLoserId] = useState('');
    const [roundDate, setRoundDate] = useState(getLocalDateString());
    const [roundFilter, setRoundFilter] = useState('');
    const [roundPage, setRoundPage] = useState(1);
    const [tourneyQ, setTourneyQ] = useState('');

    const [tName, setTName] = useState('');
    const [tDate, setTDate] = useState(getLocalDateString());
    const [n, setN] = useState('6');
    const [b, setB] = useState('0');
    const [k, setK] = useState('45');
    const [maxGain, setMaxGain] = useState('300');
    const [maxRounds, setMaxRounds] = useState('');
    const [addId, setAddId] = useState('');
    const [division, setDivision] = useState<Division>('Novice');
    const [participants, setParticipants] = useState<DraftParticipant[]>([]);

    const preview =
        winnerId && loserId && winnerId !== loserId
            ? (() => {
                  const w = debaters.find((d) => d.id === winnerId);
                  const l = debaters.find((d) => d.id === loserId);
                  if (!w || !l) return null;
                  return { w, l, r: calculatePracticeElo(w.elo, l.elo) };
              })()
            : null;

    const filteredRounds = useMemo(() => {
        return [...practiceRounds]
            .filter((r) => !roundFilter || r.winner_id === roundFilter || r.loser_id === roundFilter)
            .sort((a, b) => (a.date < b.date ? 1 : -1));
    }, [practiceRounds, roundFilter]);
    const roundSlice = filteredRounds.slice((roundPage - 1) * PAGE, roundPage * PAGE);

    const filteredTournaments = useMemo(() => {
        const q = tourneyQ.trim().toLowerCase();
        return [...tournaments]
            .filter(
                (t) =>
                    !q ||
                    (t.name && t.name.toLowerCase().includes(q)) ||
                    t.date.includes(q)
            )
            .sort((a, b) => (a.date < b.date ? 1 : -1));
    }, [tournaments, tourneyQ]);

    async function submitRound(e: React.FormEvent) {
        e.preventDefault();
        const winner = debaters.find((d) => d.id === winnerId);
        const loser = debaters.find((d) => d.id === loserId);
        if (!winner || !loser) {
            toast.push('Please select two different debaters.', 'warning');
            return;
        }
        try {
            const result = await recordPracticeRound({
                winner,
                loser,
                date: roundDate,
            });
            toast.push(
                `${winner.name} ${Math.round(winner.elo)} → ${Math.round(result.newWinnerElo)}  /  ${loser.name} ${Math.round(loser.elo)} → ${Math.round(result.newLoserElo)}`,
                'success',
                5000
            );
            setWinnerId('');
            setLoserId('');
            await refresh();
        } catch (err) {
            toast.push(
                err instanceof MutationError ? err.message : 'Failed to save match.',
                'error'
            );
        }
    }

    return (
        <div>
            <PageHeader kicker="Results" title="Matches" />
            {isAdmin && (
                <div className="grid grid-2" style={{ marginBottom: 20 }}>
                    <Card>
                        <h2 style={{ marginBottom: 12, fontSize: 18 }}>
                            Record practice round
                        </h2>
                        <form onSubmit={(e) => void submitRound(e)}>
                            <PlayerSelect
                                id="winner"
                                label="Winner"
                                value={winnerId}
                                onChange={setWinnerId}
                                debaters={active}
                            />
                            <PlayerSelect
                                id="loser"
                                label="Loser"
                                value={loserId}
                                onChange={setLoserId}
                                debaters={active}
                            />
                            <div className="field">
                                <label htmlFor="roundDate">Date</label>
                                <input
                                    id="roundDate"
                                    type="date"
                                    value={roundDate}
                                    onChange={(e) => setRoundDate(e.target.value)}
                                />
                            </div>
                            <p style={{ color: 'var(--accent)', marginBottom: 12 }}>
                                {preview
                                    ? `Win probability for ${preview.w.name}: ${(preview.r.expected * 100).toFixed(1)}%`
                                    : 'Win probability: —'}
                            </p>
                            <Button type="submit">Record round</Button>
                        </form>
                    </Card>
                    <Card>
                        <h2 style={{ marginBottom: 12, fontSize: 18 }}>
                            Record tournament
                        </h2>
                        <div className="field">
                            <label htmlFor="tName">Name (for graph)</label>
                            <input
                                id="tName"
                                value={tName}
                                onChange={(e) => setTName(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="tDate">Date</label>
                            <input
                                id="tDate"
                                type="date"
                                value={tDate}
                                onChange={(e) => setTDate(e.target.value)}
                            />
                        </div>
                        <div className="row">
                            {[
                                ['n', 'Rounds', n, setN],
                                ['b', 'Bonus', b, setB],
                                ['k', 'Affect', k, setK],
                                ['g', 'Max gain', maxGain, setMaxGain],
                                ['m', 'Max rounds', maxRounds, setMaxRounds],
                            ].map(([id, label, val, set]) => (
                                <div className="field" style={{ flex: 1 }} key={id as string}>
                                    <label>{label as string}</label>
                                    <input
                                        value={val as string}
                                        onChange={(e) =>
                                            (set as (v: string) => void)(e.target.value)
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="row">
                            <div className="field" style={{ flex: 1 }}>
                                <label>Participant</label>
                                <select
                                    value={addId}
                                    onChange={(e) => setAddId(e.target.value)}
                                >
                                    <option value="">Select…</option>
                                    {active
                                        .filter(
                                            (d) => !participants.some((p) => p.id === d.id)
                                        )
                                        .map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="field">
                                <label>Division</label>
                                <select
                                    value={division}
                                    onChange={(e) =>
                                        setDivision(e.target.value as Division)
                                    }
                                >
                                    <option>Novice</option>
                                    <option>JV</option>
                                    <option>Varsity</option>
                                </select>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    const d = active.find((x) => x.id === addId);
                                    if (!d) return;
                                    setParticipants((prev) => [
                                        ...prev,
                                        {
                                            id: d.id,
                                            name: d.name,
                                            division,
                                            prelim_wins: 0,
                                            elim_wins: 0,
                                        },
                                    ]);
                                    setAddId('');
                                }}
                            >
                                Add
                            </Button>
                        </div>
                        {participants.map((p) => (
                            <div key={p.id} className="participant-row">
                                <strong style={{ flex: 1 }}>
                                    {p.name} · {p.division}
                                </strong>
                                <label>
                                    Prelim
                                    <input
                                        type="number"
                                        min={0}
                                        value={p.prelim_wins}
                                        style={{ width: 64, marginLeft: 6 }}
                                        onChange={(e) =>
                                            setParticipants((prev) =>
                                                prev.map((x) =>
                                                    x.id === p.id
                                                        ? {
                                                              ...x,
                                                              prelim_wins: Math.max(
                                                                  0,
                                                                  Number(e.target.value)
                                                              ),
                                                          }
                                                        : x
                                                )
                                            )
                                        }
                                    />
                                </label>
                                <label>
                                    Elim
                                    <input
                                        type="number"
                                        min={0}
                                        value={p.elim_wins}
                                        style={{ width: 64, marginLeft: 6 }}
                                        onChange={(e) =>
                                            setParticipants((prev) =>
                                                prev.map((x) =>
                                                    x.id === p.id
                                                        ? {
                                                              ...x,
                                                              elim_wins: Math.max(
                                                                  0,
                                                                  Number(e.target.value)
                                                              ),
                                                          }
                                                        : x
                                                )
                                            )
                                        }
                                    />
                                </label>
                                <span className="num">
                                    Raw {p.prelim_wins + 2 * p.elim_wins}
                                </span>
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() =>
                                        setParticipants((prev) =>
                                            prev.filter((x) => x.id !== p.id)
                                        )
                                    }
                                >
                                    Remove
                                </Button>
                            </div>
                        ))}
                        <Button
                            style={{ marginTop: 12 }}
                            onClick={async () => {
                                try {
                                    const maxRoundsVal =
                                        maxRounds.trim() === ''
                                            ? null
                                            : parseInt(maxRounds, 10);
                                    const result = await recordTournament({
                                        name: tName.trim(),
                                        date: tDate,
                                        params: {
                                            n: parseInt(n, 10),
                                            b: parseFloat(b),
                                            k: parseFloat(k),
                                            maxGain: parseFloat(maxGain),
                                            maxRounds: maxRoundsVal,
                                        },
                                        participants: participants.map((p) => {
                                            const live = debaters.find(
                                                (d) => d.id === p.id
                                            ) as Debater;
                                            return {
                                                id: p.id,
                                                name: p.name,
                                                elo: live.elo,
                                                division: p.division,
                                                W_raw:
                                                    p.prelim_wins + 2 * p.elim_wins,
                                            };
                                        }),
                                        activeDebaters: active,
                                    });
                                    toast.push(
                                        `E_tourney ${result.eTourney.toFixed(3)}\n` +
                                            result.results
                                                .map(
                                                    (r) =>
                                                        `${r.name}: ${r.change >= 0 ? '+' : ''}${r.change.toFixed(1)}`
                                                )
                                                .join('\n'),
                                        'success',
                                        8000
                                    );
                                    setParticipants([]);
                                    setTName('');
                                    await refresh();
                                } catch (err) {
                                    toast.push(
                                        err instanceof MutationError
                                            ? err.message
                                            : 'Failed to record tournament.',
                                        'error'
                                    );
                                }
                            }}
                        >
                            Calculate tournament Elo
                        </Button>
                    </Card>
                </div>
            )}

            <div className="grid grid-2">
                <Card>
                    <h2 style={{ fontSize: 18, marginBottom: 12 }}>Practice rounds</h2>
                    <select
                        value={roundFilter}
                        onChange={(e) => {
                            setRoundFilter(e.target.value);
                            setRoundPage(1);
                        }}
                        style={{ marginBottom: 12 }}
                    >
                        <option value="">All debaters</option>
                        {debaters.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                    {roundSlice.length === 0 ? (
                        <EmptyState
                            title="No practice rounds"
                            body="Recorded rounds will list here."
                        />
                    ) : (
                        roundSlice.map((r) => (
                            <div key={r.id} className="match-row">
                                <span className="num">{r.date}</span>
                                <span>
                                    {nameOf(r.winner_id)} def. {nameOf(r.loser_id)}
                                </span>
                                <span>
                                    <span className="delta-pos">
                                        +{r.winner_change.toFixed(1)}
                                    </span>
                                    {' / '}
                                    <span className="delta-neg">
                                        {r.loser_change.toFixed(1)}
                                    </span>
                                    {isAdmin && (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            style={{ marginLeft: 8 }}
                                            onClick={async () => {
                                                const winner = debaters.find(
                                                    (d) => d.id === r.winner_id
                                                );
                                                const loser = debaters.find(
                                                    (d) => d.id === r.loser_id
                                                );
                                                if (!winner || !loser) return;
                                                if (
                                                    !confirm(
                                                        'Delete this round and undo its Elo changes?'
                                                    )
                                                )
                                                    return;
                                                const res = await deletePracticeRound({
                                                    roundId: r.id,
                                                    date: r.date,
                                                    winner,
                                                    loser,
                                                    winnerChange: r.winner_change,
                                                    loserChange: r.loser_change,
                                                });
                                                toast.push(
                                                    res.approximate
                                                        ? 'Deleted. Later events exist, so remaining ratings may be approximate.'
                                                        : 'Practice round deleted and Elo reverted.',
                                                    res.approximate ? 'warning' : 'success'
                                                );
                                                await refresh();
                                            }}
                                        >
                                            Undo
                                        </Button>
                                    )}
                                </span>
                            </div>
                        ))
                    )}
                    <div className="pagination">
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={roundPage === 1}
                            onClick={() => setRoundPage((p) => p - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={roundPage * PAGE >= filteredRounds.length}
                            onClick={() => setRoundPage((p) => p + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </Card>
                <Card>
                    <h2 style={{ fontSize: 18, marginBottom: 12 }}>Tournaments</h2>
                    <input
                        className="input"
                        placeholder="Search all tournaments…"
                        value={tourneyQ}
                        onChange={(e) => setTourneyQ(e.target.value)}
                        style={{ marginBottom: 12 }}
                    />
                    {filteredTournaments.length === 0 ? (
                        <EmptyState
                            title="No tournaments"
                            body="Tournament results will appear here."
                        />
                    ) : (
                        filteredTournaments.map((t) => (
                            <div key={t.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                                <strong>
                                    {t.name || 'Unnamed'} — {t.date}
                                </strong>
                                <div className="page-kicker">
                                    E_tourney {t.e_tourney.toFixed(2)}
                                </div>
                                {t.tournament_participants.map((p) => (
                                    <div key={p.debater_id} className="note">
                                        {p.debaters?.name || nameOf(p.debater_id)}:{' '}
                                        <span
                                            className={
                                                p.elo_change >= 0
                                                    ? 'delta-pos'
                                                    : 'delta-neg'
                                            }
                                        >
                                            {p.elo_change >= 0 ? '+' : ''}
                                            {p.elo_change.toFixed(1)}
                                        </span>
                                    </div>
                                ))}
                                {isAdmin && (
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        style={{ marginTop: 8 }}
                                        onClick={async () => {
                                            if (
                                                !confirm(
                                                    'Delete this tournament and revert participant Elo changes?'
                                                )
                                            )
                                                return;
                                            const res = await deleteTournament({
                                                tournamentId: t.id,
                                                date: t.date,
                                                participantChanges:
                                                    t.tournament_participants.map(
                                                        (p) => ({
                                                            debaterId: p.debater_id,
                                                            eloChange: p.elo_change,
                                                        })
                                                    ),
                                                debaters,
                                            });
                                            toast.push(
                                                res.approximate
                                                    ? 'Deleted. Later events exist, so remaining ratings may be approximate.'
                                                    : 'Tournament deleted and Elo reverted.',
                                                res.approximate ? 'warning' : 'success'
                                            );
                                            await refresh();
                                        }}
                                    >
                                        Undo
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </Card>
            </div>
        </div>
    );
}

function PlayerSelect({
    id,
    label,
    value,
    onChange,
    debaters,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    debaters: Debater[];
}) {
    return (
        <div className="field">
            <label htmlFor={id}>{label}</label>
            <select
                id={id}
                required
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Select a debater…</option>
                {debaters.map((d) => (
                    <option key={d.id} value={d.id}>
                        {d.name} ({Math.round(d.elo)})
                    </option>
                ))}
            </select>
        </div>
    );
}
