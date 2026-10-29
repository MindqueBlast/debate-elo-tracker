import { useMemo, useState } from 'react';
import { lookup, type Debater, type Division, type Team, type Tournament } from '../domain';
import {
    draftFromTournament,
    MutationError,
    previewTournament,
    saveTournament,
    type TournamentDraft,
} from '../data/mutations';
import type { AppSnapshot } from '../data/loaders';
import { Button } from './Button';

const DIVS: Division[] = ['Varsity', 'JV', 'Novice'];
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;

interface Row {
    key: string;
    a: string;
    b: string;
    division: Division;
    wins: string;
}

/**
 * Fix a saved tournament right where it's listed: names, partners, divisions,
 * wins and settings, with a live look at how everyone's Elo would move.
 */
export function TournamentEditor({
    tournament,
    data,
    teams,
    onSaved,
    onCancel,
}: {
    tournament: Tournament;
    data: AppSnapshot;
    teams: Team[];
    onSaved: (before: Tournament) => void;
    onCancel: () => void;
}) {
    const original = useMemo(() => draftFromTournament(tournament), [tournament]);
    const byId = useMemo(() => lookup(data.debaters), [data.debaters]);
    const people = useMemo(
        () => [...data.debaters].sort((x, y) => x.name.localeCompare(y.name)),
        [data.debaters]
    );
    const [name, setName] = useState(original.name);
    const [date, setDate] = useState(original.date);
    const [bonus, setBonus] = useState(String(original.params.b));
    const [affect, setAffect] = useState(String(original.params.k));
    const [maxGain, setMaxGain] = useState(String(original.params.maxGain));
    const [maxRounds, setMaxRounds] = useState(
        original.params.maxRounds == null ? '' : String(original.params.maxRounds)
    );
    const [rounds, setRounds] = useState<Record<Division, string>>(() => {
        const out = { Varsity: '', JV: '', Novice: '' } as Record<Division, string>;
        for (const d of DIVS) {
            const r = original.roundsByDivision?.[d];
            if (r != null) out[d] = String(r);
        }
        return out;
    });
    const [rows, setRows] = useState<Row[]>(() =>
        original.entries.map((e) => ({
            key: e.key,
            a: e.members[0],
            b: e.members[1] ?? '',
            division: e.division,
            wins: String(e.prelimWins),
        }))
    );
    const [more, setMore] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const n = Math.max(original.params.n, ...DIVS.map((d) => Number(rounds[d]) || 0));
    const draft: TournamentDraft = {
        id: tournament.id,
        name,
        date,
        params: {
            n,
            b: Number(bonus),
            k: Number(affect),
            maxGain: Number(maxGain),
            maxRounds: maxRounds.trim() === '' ? null : Number(maxRounds),
        },
        roundsByDivision: Object.fromEntries(
            DIVS.filter((d) => Number(rounds[d]) > 0).map((d) => [d, Number(rounds[d])])
        ),
        entries: rows
            .filter((r) => r.a)
            .map((r) => ({
                key: r.key,
                members: [r.a, r.b || null],
                division: r.division,
                prelimWins: Number(r.wins),
                elimWins: 0,
            })),
    };

    // Exactly what saving would do, and how everyone's Elo today would move
    const preview = useMemo(() => {
        try {
            if (!date || draft.entries.length === 0) return null;
            if (![draft.params.b, draft.params.k, draft.params.maxGain].every(Number.isFinite)) return null;
            if (draft.entries.some((e) => !Number.isFinite(e.prelimWins))) return null;
            return previewTournament(data, draft);
        } catch {
            return null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, name, date, bonus, affect, maxGain, maxRounds, rounds, rows]);

    const movers = useMemo(() => {
        if (!preview) return [];
        return data.debaters
            .map((d: Debater) => ({ d, delta: (preview.elo[d.id] ?? d.elo) - d.elo }))
            .filter((m) => Math.abs(m.delta) >= 0.05)
            .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    }, [preview, data.debaters]);

    const set = (key: string, patch: Partial<Row>) =>
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

    const used = new Set(rows.flatMap((r) => [r.a, r.b]).filter(Boolean));
    const options = (current: string) =>
        people.map((p) => (
            <option key={p.id} value={p.id} disabled={used.has(p.id) && p.id !== current}>
                {p.name}
                {p.status === 'graduated' ? ' (grad)' : ''}
            </option>
        ));

    async function save() {
        setError(null);
        if (rows.some((r) => !r.a)) {
            setError('Pick someone for every entry, or remove the empty row.');
            return;
        }
        setSaving(true);
        try {
            await saveTournament(data, draft, teams);
            onSaved(tournament);
        } catch (err) {
            setError(err instanceof MutationError ? err.message : 'Failed to save the tournament.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="t-editor">
            <div className="t-editor__top">
                <label>
                    Name
                    <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                    Date
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label title="30 invitational · 15 local / NYSFL / NCFL elims · 10 HAFTR / BDL">
                    Bonus
                    <input inputMode="decimal" value={bonus} onChange={(e) => setBonus(e.target.value)} />
                </label>
            </div>
            <button type="button" className="t-editor__more" onClick={() => setMore((v) => !v)}>
                {more ? '▾' : '▸'} Rounds and other settings
            </button>
            {more && (
                <div className="t-editor__top">
                    {DIVS.map((d) => (
                        <label key={d}>
                            {d} rounds
                            <input
                                inputMode="decimal"
                                placeholder={String(original.params.n)}
                                value={rounds[d]}
                                onChange={(e) => setRounds((prev) => ({ ...prev, [d]: e.target.value }))}
                            />
                        </label>
                    ))}
                    <label>
                        Affect
                        <input inputMode="decimal" value={affect} onChange={(e) => setAffect(e.target.value)} />
                    </label>
                    <label>
                        Max gain
                        <input inputMode="decimal" value={maxGain} onChange={(e) => setMaxGain(e.target.value)} />
                    </label>
                    <label>
                        Max rounds
                        <input
                            inputMode="decimal"
                            value={maxRounds}
                            onChange={(e) => setMaxRounds(e.target.value)}
                        />
                    </label>
                </div>
            )}

            <div className="t-editor__rows">
                <div className="t-editor__head">
                    <span>Person</span>
                    <span>Partner</span>
                    <span>Division</span>
                    <span title="Prelim wins + 2 × elim wins">Wins</span>
                    <span>Change</span>
                    <span />
                </div>
                {rows.map((r) => {
                    const res = preview?.entries[r.key];
                    return (
                        <div key={r.key} className="t-editor__row">
                            <select aria-label="Person" value={r.a} onChange={(e) => set(r.key, { a: e.target.value })}>
                                <option value="">Pick…</option>
                                {options(r.a)}
                            </select>
                            <select
                                aria-label="Partner"
                                value={r.b}
                                onChange={(e) => set(r.key, { b: e.target.value })}
                            >
                                <option value="">None / not on record</option>
                                {options(r.b)}
                            </select>
                            <select
                                aria-label="Division"
                                value={r.division}
                                onChange={(e) => set(r.key, { division: e.target.value as Division })}
                            >
                                {DIVS.map((d) => (
                                    <option key={d}>{d}</option>
                                ))}
                            </select>
                            <input
                                aria-label="Wins"
                                type="number"
                                min={0}
                                step={0.5}
                                value={r.wins}
                                onChange={(e) => set(r.key, { wins: e.target.value })}
                            />
                            <span className="num t-editor__change">
                                {res ? (
                                    <>
                                        <span className={res.elo_change < 0 ? 'delta-neg' : 'delta-pos'}>
                                            {signed(res.elo_change)}
                                        </span>
                                        {res.partner_elo_change != null && (
                                            <>
                                                {' / '}
                                                <span className={res.partner_elo_change < 0 ? 'delta-neg' : 'delta-pos'}>
                                                    {signed(res.partner_elo_change)}
                                                </span>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    '—'
                                )}
                            </span>
                            <button
                                type="button"
                                className="t-editor__remove"
                                aria-label="Remove entry"
                                onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                            >
                                ×
                            </button>
                        </div>
                    );
                })}
                <button
                    type="button"
                    className="t-editor__add"
                    onClick={() =>
                        setRows((prev) => [
                            ...prev,
                            {
                                key: crypto.randomUUID(),
                                a: '',
                                b: '',
                                division: prev[prev.length - 1]?.division ?? 'Varsity',
                                wins: '0',
                            },
                        ])
                    }
                >
                    + Add entry
                </button>
            </div>

            <p className="note t-editor__effect">
                {!preview
                    ? 'Fill in every entry to see the effect.'
                    : movers.length === 0
                      ? 'No change to anyone’s current Elo.'
                      : (
                            <>
                                Current Elo after saving:{' '}
                                {movers.slice(0, 6).map((m, i) => (
                                    <span key={m.d.id} style={{ whiteSpace: 'nowrap' }}>
                                        {i > 0 && ' · '}
                                        {byId.get(m.d.id)?.name}{' '}
                                        <span className={m.delta < 0 ? 'delta-neg' : 'delta-pos'}>{signed(m.delta)}</span>
                                    </span>
                                ))}
                                {movers.length > 6 && ` · ${movers.length - 6} more`}
                            </>
                        )}
            </p>
            {error && <p className="t-editor__error">{error}</p>}
            <div className="row">
                <Button size="sm" disabled={saving} onClick={() => void save()}>
                    {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}
