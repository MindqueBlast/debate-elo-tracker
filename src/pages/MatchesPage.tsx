import { useMemo, useRef, useState } from 'react';
import {
    calculatePracticeEloForPairs,
    entryChangeFor,
    getLocalDateString,
    lookup,
    pairingEloOf,
    pairingLabel,
    practiceChangeFor,
    practiceSide,
    type Division,
    type Tournament,
    type TournamentParams,
} from '../domain';
import { TournamentEditor } from '../components/TournamentEditor';
import {
    deletePracticeRound,
    deleteTournament,
    draftFromTournament,
    MutationError,
    previewTournament,
    rawWinsOf,
    recordPracticeRound,
    saveTournament,
    type TournamentDraft,
    type TournamentEntryDraft,
} from '../data/mutations';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Card, EmptyState, PageHeader } from '../components/Card';
import {
    DebatePodium,
    EmptyMatches,
    TournamentTrophy,
} from '../components/illustrations';
import {
    defaultDivision,
    EMPTY_PAIRING,
    pairingOf,
    PairingPicker,
    type PairingValue,
} from '../components/PairingPicker';
import { useAppData } from '../state/AppDataProvider';
import { useToast } from '../state/ToastProvider';

const PAGE = 10;
const TOURNEY_PAGE = 8;
const DIVS: Division[] = ['Varsity', 'JV', 'Novice'];
const SHORT: Record<Division, string> = { Varsity: 'V', JV: 'JV', Novice: 'N' };

/** Tournament bonus by type, per the league's rules. */
const TYPES = [
    { id: 'invitational', label: 'Invitational (5–6+ rounds)', bonus: 30 },
    { id: 'local', label: 'Local / NYSFL / NCFL / NSDA elims', bonus: 15 },
    { id: 'haftr', label: 'HAFTR / Citron / BDL', bonus: 10 },
] as const;

const errorText = (err: unknown, fallback: string) =>
    err instanceof MutationError ? err.message : fallback;

export function MatchesPage() {
    const { isAdmin } = useAuth();
    const data = useAppData();
    const { debaters, teams, practiceRounds, tournaments, refresh } = data;
    const toast = useToast();
    const byId = useMemo(() => lookup(debaters), [debaters]);
    const active = useMemo(() => debaters.filter((d) => d.status === 'active'), [debaters]);
    const activeTeams = useMemo(() => teams.filter((t) => t.active), [teams]);
    const [busy, setBusy] = useState(false);

    // practice round form
    const [winner, setWinner] = useState<PairingValue>(EMPTY_PAIRING);
    const [loser, setLoser] = useState<PairingValue>(EMPTY_PAIRING);
    const [roundDate, setRoundDate] = useState(getLocalDateString());

    // lists
    const [roundFilter, setRoundFilter] = useState('');
    const [roundPage, setRoundPage] = useState(1);
    const [tourneyQ, setTourneyQ] = useState('');
    const [tourneyShown, setTourneyShown] = useState(TOURNEY_PAGE);

    // tournament form
    const [tName, setTName] = useState('');
    const [tDate, setTDate] = useState(getLocalDateString());
    const [tType, setTType] = useState<string>('invitational');
    const [n, setN] = useState('6');
    const [b, setB] = useState('30');
    const [k, setK] = useState('45');
    const [maxGain, setMaxGain] = useState('300');
    const [maxRounds, setMaxRounds] = useState('');
    const [splitRounds, setSplitRounds] = useState(false);
    const [roundsBy, setRoundsBy] = useState<Record<Division, string>>({
        Varsity: '',
        JV: '',
        Novice: '',
    });
    const [pick, setPick] = useState<PairingValue>(EMPTY_PAIRING);
    const [pickDivision, setPickDivision] = useState<Division | ''>('');
    const [entries, setEntries] = useState<TournamentEntryDraft[]>([]);
    // a new tournament's id, so its preview and save line up
    const [draftId, setDraftId] = useState(() => crypto.randomUUID());
    // the tournament being fixed in place in the list
    const [editingId, setEditingId] = useState<string | null>(null);
    // undo buttons run later, so they need the data as it is then
    const dataRef = useRef(data);
    dataRef.current = data;
    const teamsRef = useRef(teams);
    teamsRef.current = teams;

    const winnerPair = pairingOf(winner);
    const loserPair = pairingOf(loser);
    const asMembers = (ids: string[]) => ids.map((id) => ({ id, elo: byId.get(id)?.elo ?? 0 }));
    const odds =
        winnerPair && loserPair
            ? calculatePracticeEloForPairs(asMembers(winnerPair), asMembers(loserPair))
            : null;
    const nameOf = (id: string) => byId.get(id)?.name ?? 'Unknown';

    const params: TournamentParams = {
        n: parseFloat(n),
        b: parseFloat(b),
        k: parseFloat(k),
        maxGain: parseFloat(maxGain),
        maxRounds: maxRounds.trim() === '' ? null : parseFloat(maxRounds),
    };
    const roundsByDivision = useMemo(() => {
        if (!splitRounds) return undefined;
        const out: Partial<Record<Division, number>> = {};
        for (const d of DIVS) {
            const v = parseFloat(roundsBy[d]);
            if (Number.isFinite(v) && v > 0) out[d] = v;
        }
        return out;
    }, [splitRounds, roundsBy]);

    const draft: TournamentDraft = {
        id: draftId,
        name: tName,
        date: tDate,
        params,
        roundsByDivision,
        entries,
    };

    // Exactly what saving would do, worked out from everyone's Elo going into this date
    const projected = useMemo(() => {
        if (entries.length === 0 || !Number.isFinite(params.n) || params.n <= 0) return null;
        if (![params.b, params.k, params.maxGain].every(Number.isFinite)) return null;
        try {
            return previewTournament(data, draft);
        } catch {
            return null;
        }
    }, [data, entries, n, b, k, maxGain, maxRounds, roundsByDivision, tDate, draftId]);

    const usedInEntries = entries.flatMap((e) => e.members.filter(Boolean) as string[]);

    const filteredRounds = useMemo(() => {
        return [...practiceRounds]
            .filter((r) => !roundFilter || practiceSide(r, roundFilter) !== null)
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }, [practiceRounds, roundFilter]);
    const roundSlice = filteredRounds.slice((roundPage - 1) * PAGE, roundPage * PAGE);

    const filteredTournaments = useMemo(() => {
        const q = tourneyQ.trim().toLowerCase();
        return [...tournaments]
            .filter((t) => {
                if (!q) return true;
                if (t.name?.toLowerCase().includes(q) || t.date.includes(q)) return true;
                return t.tournament_participants.some((p) =>
                    pairingLabel([p.debater_id, p.partner_id], byId).toLowerCase().includes(q)
                );
            })
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }, [tournaments, tourneyQ, byId]);

    async function submitRound(e: React.FormEvent) {
        e.preventDefault();
        if (!winnerPair || !loserPair) {
            toast.push('Pick both sides (two people each).', 'warning');
            return;
        }
        setBusy(true);
        try {
            const changes = await recordPracticeRound(data, {
                winner: winnerPair,
                loser: loserPair,
                date: roundDate,
            });
            toast.push(
                changes.map((m) => `${nameOf(m.id)} ${signed(m.change)}`).join('  ·  '),
                'success',
                5000
            );
            setWinner(EMPTY_PAIRING);
            setLoser(EMPTY_PAIRING);
            await refresh();
        } catch (err) {
            toast.push(errorText(err, 'Failed to save the round.'), 'error');
        } finally {
            setBusy(false);
        }
    }

    function addEntry() {
        const members = pairingOf(pick);
        if (!members) {
            toast.push('Pick a team or two people.', 'warning');
            return;
        }
        if (members.some((id) => usedInEntries.includes(id))) {
            toast.push('Someone in that pairing is already entered.', 'warning');
            return;
        }
        setEntries((prev) => [
            ...prev,
            {
                key: crypto.randomUUID(),
                members,
                division: pickDivision || defaultDivision(pick, teams, debaters),
                prelimWins: 0,
                elimWins: 0,
            },
        ]);
        setPick(EMPTY_PAIRING);
        setPickDivision('');
    }

    function resetTournamentForm() {
        setEntries([]);
        setTName('');
        setTDate(getLocalDateString());
        setTType('invitational');
        setN('6');
        setB('30');
        setK('45');
        setMaxGain('300');
        setMaxRounds('');
        setSplitRounds(false);
        setRoundsBy({ Varsity: '', JV: '', Novice: '' });
        setPick(EMPTY_PAIRING);
        setPickDivision('');
        setDraftId(crypto.randomUUID());
    }

    /** Run an undo against the data as it is now. */
    async function undo(action: () => Promise<unknown>, done: string) {
        try {
            await action();
            toast.push(done, 'success');
        } catch (err) {
            toast.push(errorText(err, 'Could not undo. Refresh and fix it by hand.'), 'error');
        }
        await refresh();
    }

    /** Put a tournament back exactly as it was saved before. */
    const restore = (before: Tournament) =>
        undo(
            () => saveTournament(dataRef.current, draftFromTournament(before), teamsRef.current),
            `${before.name || 'Tournament'} is back the way it was.`
        );

    async function submitTournament() {
        setBusy(true);
        const id = draftId;
        try {
            const result = await saveTournament(data, draft, teams);
            toast.push(
                `Recorded. E_tourney ${result.eTourney.toFixed(3)}\n` +
                    entries
                        .map((e) => {
                            const r = result.entries[e.key];
                            if (!r) return '';
                            return [
                                `${nameOf(e.members[0])} ${signed(r.elo_change)}`,
                                e.members[1] && r.partner_elo_change != null
                                    ? `${nameOf(e.members[1])} ${signed(r.partner_elo_change)}`
                                    : '',
                            ]
                                .filter(Boolean)
                                .join(', ');
                        })
                        .filter(Boolean)
                        .join('\n'),
                'success',
                12000,
                {
                    label: 'Undo',
                    onClick: () => {
                        const saved = dataRef.current.tournaments.find((t) => t.id === id);
                        if (saved) {
                            void undo(
                                () => deleteTournament(dataRef.current, saved),
                                'Undone: the tournament was removed again.'
                            );
                        }
                    },
                }
            );
            resetTournamentForm();
            await refresh();
        } catch (err) {
            toast.push(errorText(err, 'Failed to save the tournament.'), 'error');
        } finally {
            setBusy(false);
        }
    }

    async function removeTournament(t: Tournament) {
        if (
            !confirm(
                `Delete ${t.name || 'this tournament'} (${t.date})? Everyone's Elo is recalculated as if it never happened.`
            )
        ) {
            return;
        }
        try {
            await deleteTournament(data, t);
            if (editingId === t.id) setEditingId(null);
            toast.push('Tournament deleted. Everyone was recalculated without it.', 'success', 12000, {
                label: 'Undo',
                onClick: () => void restore(t),
            });
            await refresh();
        } catch (err) {
            toast.push(errorText(err, 'Failed to delete the tournament.'), 'error');
        }
    }

    async function afterEdit(before: Tournament) {
        setEditingId(null);
        toast.push(
            `${before.name || 'Tournament'} saved. Everyone from ${before.date} on was recalculated.`,
            'success',
            12000,
            { label: 'Undo', onClick: () => void restore(before) }
        );
        await refresh();
    }

    return (
        <div>
            <PageHeader
                kicker="Results"
                title="Matches"
                illustration={<DebatePodium size={72} tone="accent" />}
            />
            {isAdmin && (
                <div className="grid grid-2" style={{ marginBottom: 20 }}>
                    <Card>
                        <h2 className="section-heading">
                            <DebatePodium size={32} tone="accent" />
                            Record practice round
                        </h2>
                        <form onSubmit={(e) => void submitRound(e)}>
                            <PairingPicker
                                id="winner"
                                label="Winner"
                                value={winner}
                                onChange={setWinner}
                                debaters={active}
                                teams={activeTeams}
                                exclude={loserPair ?? []}
                            />
                            <PairingPicker
                                id="loser"
                                label="Loser"
                                value={loser}
                                onChange={setLoser}
                                debaters={active}
                                teams={activeTeams}
                                exclude={winnerPair ?? []}
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
                            <p className="note" style={{ marginBottom: 12 }}>
                                {odds && winnerPair ? (
                                    <>
                                        Win probability for {pairingLabel(winnerPair, byId)}:{' '}
                                        {(odds.expected * 100).toFixed(1)}%. If they win:{' '}
                                        <Deltas
                                            items={[...odds.winners, ...odds.losers].map((m) => ({
                                                id: m.id,
                                                name: nameOf(m.id),
                                                change: m.change,
                                            }))}
                                        />
                                    </>
                                ) : (
                                    'Each person’s change uses their own Elo against the other pair’s average.'
                                )}
                            </p>
                            <Button type="submit" disabled={busy}>
                                Record round
                            </Button>
                        </form>
                    </Card>
                    <Card>
                        <h2 className="section-heading">
                            <TournamentTrophy size={32} tone="gold" />
                            Record tournament
                        </h2>
                        <div className="grid grid-2 tight">
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
                        </div>
                        <div className="field">
                            <label htmlFor="tType">Type</label>
                            <select
                                id="tType"
                                value={tType}
                                onChange={(e) => {
                                    setTType(e.target.value);
                                    const type = TYPES.find((t) => t.id === e.target.value);
                                    if (type) setB(String(type.bonus));
                                }}
                            >
                                {TYPES.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.label} · bonus {t.bonus}
                                    </option>
                                ))}
                                <option value="custom">Custom bonus</option>
                            </select>
                        </div>
                        <div className="row">
                            {(
                                [
                                    ['n', 'Rounds', n, setN],
                                    ['b', 'Bonus', b, setB],
                                    ['k', 'Affect', k, setK],
                                    ['g', 'Max gain', maxGain, setMaxGain],
                                    ['m', 'Max rounds', maxRounds, setMaxRounds],
                                ] as const
                            ).map(([id, label, val, set]) => (
                                <div className="field" style={{ flex: 1, minWidth: 72 }} key={id}>
                                    <label htmlFor={`param-${id}`}>{label}</label>
                                    <input
                                        id={`param-${id}`}
                                        inputMode="decimal"
                                        value={val}
                                        onChange={(e) => {
                                            set(e.target.value);
                                            if (id === 'b') setTType('custom');
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        <label className="row check">
                            <input
                                type="checkbox"
                                checked={splitRounds}
                                onChange={(e) => setSplitRounds(e.target.checked)}
                            />
                            Rounds differ by division
                        </label>
                        {splitRounds && (
                            <div className="row">
                                {DIVS.map((d) => (
                                    <div className="field" style={{ flex: 1 }} key={d}>
                                        <label htmlFor={`rounds-${d}`}>{d} rounds</label>
                                        <input
                                            id={`rounds-${d}`}
                                            inputMode="decimal"
                                            placeholder={n}
                                            value={roundsBy[d]}
                                            onChange={(e) =>
                                                setRoundsBy((prev) => ({
                                                    ...prev,
                                                    [d]: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="entry-adder">
                            <PairingPicker
                                id="entry"
                                label="Entry"
                                value={pick}
                                onChange={(v) => {
                                    setPick(v);
                                    setPickDivision('');
                                }}
                                debaters={active}
                                teams={activeTeams}
                                exclude={usedInEntries}
                            />
                            <div className="row" style={{ alignItems: 'flex-end' }}>
                                <div className="field" style={{ flex: 1 }}>
                                    <label htmlFor="entryDivision">Division</label>
                                    <select
                                        id="entryDivision"
                                        value={
                                            pickDivision ||
                                            (pairingOf(pick)
                                                ? defaultDivision(pick, teams, debaters)
                                                : '')
                                        }
                                        onChange={(e) =>
                                            setPickDivision(e.target.value as Division)
                                        }
                                    >
                                        {!pairingOf(pick) && <option value="">—</option>}
                                        {DIVS.map((d) => (
                                            <option key={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <Button type="button" variant="secondary" onClick={addEntry}>
                                        Add entry
                                    </Button>
                                </div>
                            </div>
                        </div>
                        {entries.map((entry) => {
                            const preview = projected?.entries[entry.key];
                            const set = (patch: Partial<TournamentEntryDraft>) =>
                                setEntries((prev) =>
                                    prev.map((x) => (x.key === entry.key ? { ...x, ...patch } : x))
                                );
                            return (
                                <div key={entry.key} className="participant-row">
                                    <div style={{ flex: 1, minWidth: 140 }}>
                                        <strong>{pairingLabel(entry.members, byId)}</strong>
                                        <div className="note">
                                            <select
                                                aria-label="Division"
                                                className="inline-select"
                                                value={entry.division}
                                                onChange={(e) =>
                                                    set({ division: e.target.value as Division })
                                                }
                                            >
                                                {DIVS.map((d) => (
                                                    <option key={d}>{d}</option>
                                                ))}
                                            </select>{' '}
                                            · Elo {Math.round(pairingEloOf(entry.members, byId))}
                                        </div>
                                    </div>
                                        <>
                                            <label>
                                                Prelim
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step={0.5}
                                                    value={entry.prelimWins}
                                                    style={{ width: 60, marginLeft: 6 }}
                                                    onChange={(e) =>
                                                        set({ prelimWins: Math.max(0, Number(e.target.value)) })
                                                    }
                                                />
                                            </label>
                                            <label>
                                                Elim
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={entry.elimWins}
                                                    style={{ width: 60, marginLeft: 6 }}
                                                    onChange={(e) =>
                                                        set({ elimWins: Math.max(0, Number(e.target.value)) })
                                                    }
                                                />
                                            </label>
                                            <span className="num" title="Raw wins (elims count double)">
                                                Raw {rawWinsOf(entry.prelimWins, entry.elimWins)}
                                            </span>
                                        </>
                                    <span
                                        className="num"
                                        style={{ minWidth: 96, textAlign: 'right', whiteSpace: 'nowrap' }}
                                        title="Change for each partner, in the order listed"
                                    >
                                        {preview && (
                                            <>
                                                <span className={preview.elo_change < 0 ? 'delta-neg' : 'delta-pos'}>
                                                    {signed(preview.elo_change)}
                                                </span>
                                                {preview.partner_elo_change != null && (
                                                    <>
                                                        {' / '}
                                                        <span
                                                            className={
                                                                preview.partner_elo_change < 0
                                                                    ? 'delta-neg'
                                                                    : 'delta-pos'
                                                            }
                                                        >
                                                            {signed(preview.partner_elo_change)}
                                                        </span>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() =>
                                            setEntries((prev) => prev.filter((x) => x.key !== entry.key))
                                        }
                                    >
                                        Remove
                                    </Button>
                                </div>
                            );
                        })}
                        {projected && (
                            <p className="note" style={{ marginTop: 8 }}>
                                E_tourney {projected.eTourney.toFixed(3)}. Each partner’s change
                                uses their own Elo, so the higher-rated partner gains less for the
                                same result.
                            </p>
                        )}
                        <div className="row" style={{ marginTop: 12 }}>
                            <Button
                                disabled={busy || entries.length === 0}
                                onClick={() => void submitTournament()}
                            >
                                Record tournament
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            <div className="grid grid-2">
                <Card>
                    <h2 style={{ fontSize: 18, marginBottom: 12 }}>Practice rounds</h2>
                    <select
                        aria-label="Filter by person"
                        className="select"
                        value={roundFilter}
                        onChange={(e) => {
                            setRoundFilter(e.target.value);
                            setRoundPage(1);
                        }}
                        style={{ marginBottom: 12 }}
                    >
                        <option value="">Everyone</option>
                        {[...debaters]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                    </select>
                    {roundSlice.length === 0 ? (
                        <EmptyState
                            title="No practice rounds"
                            body="Recorded rounds will list here."
                            illustration={<EmptyMatches size={80} />}
                        />
                    ) : (
                        roundSlice.map((r) => (
                            <div key={r.id} className="match-row match-row--practice">
                                <span className="num">{r.date}</span>
                                <span>
                                    {pairingLabel([r.winner_id, r.winner_partner_id], byId)} def.{' '}
                                    {pairingLabel([r.loser_id, r.loser_partner_id], byId)}
                                    <div className="note">
                                        <Deltas
                                            items={[r.winner_id, r.winner_partner_id, r.loser_id, r.loser_partner_id]
                                                .filter((x): x is string => !!x)
                                                .map((id) => ({
                                                    id,
                                                    name: nameOf(id),
                                                    change: practiceChangeFor(r, id),
                                                }))}
                                        />
                                    </div>
                                </span>
                                <span className="num match-row__deltas">
                                    {isAdmin && (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            style={{ marginLeft: 8 }}
                                            onClick={async () => {
                                                if (!confirm('Delete this round? Everyone is recalculated without it.')) return;
                                                try {
                                                    await deletePracticeRound(data, r.id);
                                                    toast.push('Practice round deleted.', 'success');
                                                    await refresh();
                                                } catch (err) {
                                                    toast.push(errorText(err, 'Failed to delete the round.'), 'error');
                                                }
                                            }}
                                        >
                                            Delete
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
                        placeholder="Search tournaments or people…"
                        value={tourneyQ}
                        onChange={(e) => {
                            setTourneyQ(e.target.value);
                            setTourneyShown(TOURNEY_PAGE);
                        }}
                        style={{ marginBottom: 12 }}
                    />
                    {filteredTournaments.length === 0 ? (
                        <EmptyState
                            title="No tournaments"
                            body="Tournament results will appear here."
                            illustration={<TournamentTrophy size={64} tone="gold" />}
                        />
                    ) : (
                        filteredTournaments.slice(0, tourneyShown).map((t) =>
                            editingId === t.id ? (
                                <div key={t.id} className="tourney-block tourney-block--editing">
                                    <strong>
                                        Editing {t.name || 'Unnamed'} — {t.date}
                                    </strong>
                                    <TournamentEditor
                                        tournament={t}
                                        data={data}
                                        teams={teams}
                                        onSaved={(before) => void afterEdit(before)}
                                        onCancel={() => setEditingId(null)}
                                    />
                                </div>
                            ) : (
                            <div key={t.id} className="tourney-block">
                                <strong>
                                    {t.name || 'Unnamed'} — {t.date}
                                </strong>
                                <div className="page-kicker">
                                    E_tourney {t.e_tourney.toFixed(2)}
                                    {t.bonus != null && ` · bonus ${t.bonus}`}
                                </div>
                                {[...t.tournament_participants]
                                    .sort(
                                        (a, b) =>
                                            DIVS.indexOf(a.division) - DIVS.indexOf(b.division) ||
                                            avgChange(b) - avgChange(a)
                                    )
                                    .map((p) => (
                                        <div key={p.id ?? p.debater_id} className="note entry-line">
                                            <span className="pill pill-div">{SHORT[p.division]}</span>
                                            <span className="entry-line__name">
                                                <Deltas
                                                    items={[p.debater_id, p.partner_id]
                                                        .filter((x): x is string => !!x)
                                                        .map((id) => ({
                                                            id,
                                                            name: nameOf(id),
                                                            change: entryChangeFor(p, id),
                                                        }))}
                                                />
                                                {!p.partner_id && <span className="muted"> + ?</span>}
                                            </span>
                                            <span className="num muted">raw {p.raw_wins}</span>
                                        </div>
                                    ))}
                                {isAdmin && (
                                    <div className="row" style={{ marginTop: 8 }}>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            disabled={busy}
                                            onClick={() => setEditingId(t.id)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            disabled={busy}
                                            onClick={() => void removeTournament(t)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                )}
                            </div>
                            )
                        )
                    )}
                    {filteredTournaments.length > tourneyShown && (
                        <div className="pagination">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setTourneyShown((s) => s + TOURNEY_PAGE)}
                            >
                                Show more ({filteredTournaments.length - tourneyShown} left)
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;

const avgChange = (p: { elo_change: number; partner_elo_change?: number | null; partner_id?: string | null }) =>
    p.partner_id ? (p.elo_change + (p.partner_elo_change ?? p.elo_change)) / 2 : p.elo_change;

/** "Jiayi +12.3 · Leon +15.1" */
function Deltas({ items }: { items: { id: string; name: string; change: number }[] }) {
    return (
        <>
            {items.map((it, i) => (
                <span key={it.id} style={{ whiteSpace: 'nowrap' }}>
                    {i > 0 && ' · '}
                    {it.name}{' '}
                    <span className={it.change < 0 ? 'delta-neg' : 'delta-pos'}>{signed(it.change)}</span>
                </span>
            ))}
        </>
    );
}
