import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
    calculatePracticeEloForPairs,
    defaultLost,
    entryChangeFor,
    getLocalDateString,
    lookup,
    pairingEloOf,
    pairingLabel,
    practiceChangeFor,
    practiceSide,
    seasonLabel,
    seasonOf,
    TOURNAMENT_TYPES,
    typeName,
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
import { Segmented } from '../components/Segmented';
import {
    DebatePodium,
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

const PAGE = 12;
const TOURNEY_PAGE = 24;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "Nov 23" */
const shortDate = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)} ${Number(d.slice(8, 10))}`;
/** "2026-11" → "November 2026" */
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const DIVS: Division[] = ['Varsity', 'JV', 'Novice'];
const SHORT: Record<Division, string> = { Varsity: 'V', JV: 'JV', Novice: 'N' };


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

    // which list: tournaments or practice rounds (kept in the address, so it can be linked)
    const [searchParams, setParams] = useSearchParams();
    const view: 'tournaments' | 'practice' = searchParams.get('view') === 'practice' ? 'practice' : 'tournaments';
    const setView = (v: 'tournaments' | 'practice') =>
        setParams(v === 'practice' ? { view: 'practice' } : {}, { replace: true });
    // the record-a-tournament form opens on demand, so the page leads with results
    const [recording, setRecording] = useState(false);
    const [seasonPick, setSeasonPick] = useState('all');
    const [openIds, setOpenIds] = useState<Set<string>>(new Set());
    // the newest tournament starts open, once the data is in
    const openedNewest = useRef(false);
    useEffect(() => {
        if (openedNewest.current || tournaments.length === 0) return;
        openedNewest.current = true;
        const newest = [...tournaments].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        setOpenIds(new Set([newest.id]));
    }, [tournaments]);

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
    // tournament bonus by type, and K, as set in Settings → Scoring
    const TYPES = TOURNAMENT_TYPES.map((t) => ({ ...t, bonus: data.config.bonuses[t.id] }));
    const [b, setB] = useState(() => String(data.config.bonuses.invitational));
    const [k, setK] = useState(() => String(data.config.k));
    // blank: no cap on gains
    const [maxGain, setMaxGain] = useState('');
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
        maxGain: maxGain.trim() === '' ? null : parseFloat(maxGain),
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

    // "Lost" follows the tournament and prelim wins until someone ticks or unticks it
    const autoLost = (e: TournamentEntryDraft): boolean =>
        defaultLost(params.b, e.prelimWins, roundsByDivision?.[e.division] ?? params.n);
    const draft: TournamentDraft = {
        id: draftId,
        name: tName,
        date: tDate,
        params,
        roundsByDivision,
        entries: entries.map((e) => ({ ...e, lost: e.lost ?? autoLost(e) })),
    };

    // Exactly what saving would do, worked out from everyone's Elo going into this date
    const projected = useMemo(() => {
        if (entries.length === 0 || !Number.isFinite(params.n) || params.n <= 0) return null;
        if (![params.b, params.k].every(Number.isFinite)) return null;
        if (params.maxGain !== null && !Number.isFinite(params.maxGain)) return null;
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

    const seasons = useMemo(
        () => [...new Set(tournaments.map((t) => seasonOf(t.date)))].sort().reverse(),
        [tournaments]
    );
    const filteredTournaments = useMemo(() => {
        const q = tourneyQ.trim().toLowerCase();
        return [...tournaments]
            .filter((t) => seasonPick === 'all' || seasonOf(t.date) === seasonPick)
            .filter((t) => {
                if (!q) return true;
                if (t.name?.toLowerCase().includes(q) || t.date.includes(q)) return true;
                return t.tournament_participants.some((p) =>
                    pairingLabel([p.debater_id, p.partner_id], byId).toLowerCase().includes(q)
                );
            })
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }, [tournaments, tourneyQ, byId, seasonPick]);
    const shownTournaments = filteredTournaments.slice(0, tourneyShown);
    // newest season first, each season's tournaments newest first
    const seasonGroups = useMemo(() => {
        const groups = new Map<string, Tournament[]>();
        for (const t of shownTournaments) {
            const sn = seasonOf(t.date);
            groups.set(sn, [...(groups.get(sn) ?? []), t]);
        }
        return [...groups.entries()];
    }, [shownTournaments]);
    const monthGroups = useMemo(() => {
        const groups = new Map<string, typeof roundSlice>();
        for (const r of roundSlice) {
            const m = r.date.slice(0, 7);
            groups.set(m, [...(groups.get(m) ?? []), r]);
        }
        return [...groups.entries()];
    }, [roundSlice]);

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
                changes.map((m) => `${nameOf(m.id)} ${signed(m.change)}`).join(', '),
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
                lost: null,
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
        setB(String(data.config.bonuses.invitational));
        setK(String(data.config.k));
        setMaxGain('');
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

    const typeOf = (bonus: number | null | undefined) => typeName(bonus, data.config);
    // the best single change anyone from Syosset had there
    const bestOf = (t: Tournament) =>
        Math.max(
            ...t.tournament_participants.flatMap((p) =>
                [p.debater_id, p.partner_id].filter((x): x is string => !!x).map((id) => entryChangeFor(p, id))
            )
        );
    const toggle = (id: string) =>
        setOpenIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    return (
        <div>
            <PageHeader
                title="Matches"
                sub={
                    view === 'tournaments'
                        ? 'Every tournament by season. Open one to see each pair’s result and each person’s change.'
                        : 'Practice rounds, newest first, with each person’s change.'
                }
                actions={
                    <Segmented
                        label="Show"
                        value={view}
                        onChange={setView}
                        options={[
                            { value: 'tournaments', label: `Tournaments (${tournaments.length})` },
                            { value: 'practice', label: `Practice rounds (${practiceRounds.length})` },
                        ]}
                    />
                }
            />

            {view === 'tournaments' ? (
                <>
                    <div className="matches-toolbar">
                        <input
                            className="input"
                            placeholder="Search tournaments or people…"
                            aria-label="Search tournaments or people"
                            value={tourneyQ}
                            onChange={(e) => {
                                setTourneyQ(e.target.value);
                                setTourneyShown(TOURNEY_PAGE);
                            }}
                        />
                        <div className="season-presets" role="group" aria-label="Season">
                            {['all', ...seasons].map((sn) => (
                                <button
                                    key={sn}
                                    type="button"
                                    className="season-presets__btn"
                                    aria-pressed={seasonPick === sn}
                                    onClick={() => {
                                        setSeasonPick(sn);
                                        setTourneyShown(TOURNEY_PAGE);
                                    }}
                                >
                                    {sn === 'all' ? 'All seasons' : seasonLabel(sn)}
                                </button>
                            ))}
                        </div>
                        {isAdmin && (
                            <Button
                                variant={recording ? 'secondary' : 'primary'}
                                onClick={() => setRecording((r) => !r)}
                                aria-expanded={recording}
                            >
                                {recording ? 'Close the form' : 'Record a tournament'}
                            </Button>
                        )}
                    </div>
                    <AnimatePresence initial={false}>
                        {isAdmin && recording && (
                            <motion.div
                                key="record"
                                className="reveal"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <div className="record-wrap">
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
                                                    {t.label}, bonus {t.bonus}
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
                                                    placeholder={id === 'g' ? 'No cap' : id === 'm' ? 'None' : undefined}
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
                                                    {!pairingOf(pick) && <option value="">Pick…</option>}
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
                                                    <div className="note inline-meta">
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
                                                        </select>
                                                        <span className="num">
                                                            Elo {Math.round(pairingEloOf(entry.members, byId))}
                                                        </span>
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
                                                        <input
                                                            type="checkbox"
                                                            className="lost-check"
                                                            aria-label="Lost"
                                                            title="Lost"
                                                            checked={entry.lost ?? autoLost(entry)}
                                                            onChange={(e) => set({ lost: e.target.checked })}
                                                        />
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
                                            uses their own Elo, so the higher-rated partner gains less (and loses
                                            more) for the same result.
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
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {shownTournaments.length === 0 ? (
                        <EmptyState
                            title={tourneyQ || seasonPick !== 'all' ? 'No tournaments match' : 'No tournaments'}
                            body={
                                tourneyQ || seasonPick !== 'all'
                                    ? 'Try another name, or all seasons.'
                                    : 'Tournament results will appear here.'
                            }
                        />
                    ) : (
                        seasonGroups.map(([sn, list]) => (
                            <section key={sn} className="season-group" aria-label={`${seasonLabel(sn)} season`}>
                                <h2 className="season-group__head">
                                    {seasonLabel(sn)}
                                    <span className="season-group__count">
                                        {list.length} {list.length === 1 ? 'tournament' : 'tournaments'}
                                    </span>
                                </h2>
                                <ol className="tourney-list">
                                    {list.map((t, i) => {
                                        const open = openIds.has(t.id) || editingId === t.id;
                                        const best = bestOf(t);
                                        return (
                                            <li
                                                key={t.id}
                                                className={`tourney${open ? ' is-open' : ''}`}
                                                style={{ '--i': i } as CSSProperties}
                                            >
                                                <button
                                                    type="button"
                                                    className="tourney__row"
                                                    aria-expanded={open}
                                                    aria-controls={`tourney-${t.id}`}
                                                    onClick={() => editingId !== t.id && toggle(t.id)}
                                                >
                                                    <span className="tourney__date num">{shortDate(t.date)}</span>
                                                    <span className="tourney__name">{t.name || 'Unnamed'}</span>
                                                    <span className="tourney__type">
                                                        {typeOf(t.bonus)}
                                                        {t.rated === false && <span className="pill tourney__unrated">Unrated</span>}
                                                    </span>
                                                    <span className="tourney__count num">
                                                        {t.tournament_participants.length}{' '}
                                                        {t.tournament_participants.length === 1 ? 'entry' : 'entries'}
                                                    </span>
                                                    <span
                                                        className={`tourney__best delta ${best >= 0 ? 'delta-pos' : 'delta-neg'}`}
                                                        title="The best single change from Syosset there"
                                                    >
                                                        {t.rated !== false && Number.isFinite(best) ? signed(best) : ''}
                                                    </span>
                                                    <svg className="tourney__chev" width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
                                                        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                                                    </svg>
                                                </button>
                                                <AnimatePresence initial={false}>
                                                    {open && (
                                                        <motion.div
                                                            key="body"
                                                            id={`tourney-${t.id}`}
                                                            className="reveal"
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                                                        >
                                                            <div className="tourney__body">
                                                                {editingId === t.id ? (
                                                                    <div className="tourney-block--editing">
                                                                        <strong>
                                                                            Editing {t.name || 'Unnamed'}, {t.date}
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
                                                                    <>
                                                                        <div className="tourney-meta">
                                                                            {t.rated !== false && (
                                                                                <span className="num" title="The tournament’s average wins, what each result is measured against">
                                                                                    E_tourney {t.e_tourney.toFixed(2)}
                                                                                </span>
                                                                            )}
                                                                            {t.bonus != null && <span className="num">Bonus {t.bonus}</span>}
                                                                            {t.rated === false && (
                                                                                <span>Doesn’t count toward Elo (Settings → Data)</span>
                                                                            )}
                                                                        </div>
                                                                        {[...t.tournament_participants]
                                                                            .sort(
                                                                                (a, b) =>
                                                                                    DIVS.indexOf(a.division) - DIVS.indexOf(b.division) ||
                                                                                    avgChange(b) - avgChange(a)
                                                                            )
                                                                            .map((p, i) => (
                                                                                <div
                                                                                    key={p.id ?? p.debater_id}
                                                                                    className="note entry-line"
                                                                                    style={{ '--i': i } as CSSProperties}
                                                                                >
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
                                                                            <div className="row" style={{ marginTop: 12 }}>
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
                                                                    </>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>
                        ))
                    )}
                    {filteredTournaments.length > tourneyShown && (
                        <div className="pagination">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setTourneyShown((n) => n + TOURNEY_PAGE)}
                            >
                                Show more ({filteredTournaments.length - tourneyShown} left)
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <div className={`grid ${isAdmin ? 'practice-grid' : ''}`}>
                    {isAdmin && (
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
                    )}
                    <Card>
                        <h2 className="card-title">
                            Practice rounds
                            <span className="card-title__meta">
                                {filteredRounds.length} {roundFilter ? `with ${nameOf(roundFilter)}` : 'recorded'}
                            </span>
                        </h2>
                        <select
                            aria-label="Filter by person"
                            className="select practice-filter"
                            value={roundFilter}
                            onChange={(e) => {
                                setRoundFilter(e.target.value);
                                setRoundPage(1);
                            }}
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
                                body={
                                    isAdmin
                                        ? 'Record one with the form, and it shows up here with everyone’s change.'
                                        : 'Recorded rounds will list here.'
                                }
                            />
                        ) : (
                            monthGroups.map(([month, rounds]) => (
                                <section key={month} className="practice-month" aria-label={monthLabel(month)}>
                                    <h3 className="practice-month__head">{monthLabel(month)}</h3>
                                    {rounds.map((r, i) => (
                                        <div key={r.id} className="practice-row" style={{ '--i': i } as CSSProperties}>
                                            <span className="practice-row__date num">{Number(r.date.slice(8, 10))}</span>
                                            <span className="practice-row__main">
                                                <span>
                                                    <strong>{pairingLabel([r.winner_id, r.winner_partner_id], byId)}</strong>{' '}
                                                    <span className="muted">def.</span>{' '}
                                                    {pairingLabel([r.loser_id, r.loser_partner_id], byId)}
                                                </span>
                                                <span className="note">
                                                    <Deltas
                                                        items={[r.winner_id, r.winner_partner_id, r.loser_id, r.loser_partner_id]
                                                            .filter((x): x is string => !!x)
                                                            .map((id) => ({
                                                                id,
                                                                name: nameOf(id),
                                                                change: practiceChangeFor(r, id),
                                                            }))}
                                                    />
                                                </span>
                                            </span>
                                            {isAdmin && (
                                                <Button
                                                    size="sm"
                                                    variant="danger"
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
                                        </div>
                                    ))}
                                </section>
                            ))
                        )}
                        {filteredRounds.length > PAGE && (
                            <div className="pagination">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={roundPage === 1}
                                    onClick={() => setRoundPage((p) => p - 1)}
                                >
                                    Newer
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={roundPage * PAGE >= filteredRounds.length}
                                    onClick={() => setRoundPage((p) => p + 1)}
                                >
                                    Older
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;

const avgChange = (p: { elo_change: number; partner_elo_change?: number | null; partner_id?: string | null }) =>
    p.partner_id ? (p.elo_change + (p.partner_elo_change ?? p.elo_change)) / 2 : p.elo_change;

/** "Jiayi +12.3, Leon +15.1" */
function Deltas({ items }: { items: { id: string; name: string; change: number }[] }) {
    return (
        <>
            {items.map((it, i) => (
                <span key={it.id} style={{ whiteSpace: 'nowrap' }}>
                    {i > 0 && ', '}
                    {it.name}{' '}
                    <span className={it.change < 0 ? 'delta-neg' : 'delta-pos'}>{signed(it.change)}</span>
                </span>
            ))}
        </>
    );
}
