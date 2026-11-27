import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
    dataChecks,
    getLocalDateString,
    seasonLabel,
    seasonOf,
    TOURNAMENT_TYPES,
    typeOfBonus,
    type Check,
} from '../../domain';
import { fixTournaments, mergePeople, stateOf, type TournamentFix } from '../../data/mutations';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';

const SHOWN = 6;

export function DataTab() {
    return (
        <div className="data-tab">
            <ChecksCard />
            <TournamentsCard />
        </div>
    );
}

function ChecksCard() {
    const data = useAppData();
    const toast = useToast();
    const checks = useMemo(() => dataChecks(stateOf(data), getLocalDateString()), [data]);
    const [open, setOpen] = useState<Set<string>>(new Set());
    const [merging, setMerging] = useState<[string, string] | null>(null);
    const [keep, setKeep] = useState<string>('');
    const name = (id: string) => data.debaters.find((d) => d.id === id)?.name ?? 'Someone';
    const since = (id: string) => data.inputs.people.find((p) => p.id === id)?.start_date ?? '';

    return (
        <Card>
            <div className="card-title">Checks</div>
            <p className="note card-lead">
                Likely mistakes, worked out from everything recorded.
            </p>
            {checks.length === 0 ? (
                <p className="note">Nothing looks off.</p>
            ) : (
                <div className="checks">
                    {checks.map((c: Check) => {
                        const all = open.has(c.id);
                        const items = all ? c.items : c.items.slice(0, SHOWN);
                        return (
                            <section key={c.id} className={`check check--${c.level}`} aria-labelledby={`check-${c.id}`}>
                                <div className="check__head">
                                    <h3 id={`check-${c.id}`}>{c.title}</h3>
                                    <span className={`pill ${c.level === 'problem' ? 'pill-loss' : ''}`}>
                                        {c.level === 'problem' ? 'Fix' : 'Worth a look'}
                                    </span>
                                    <span className="check__count num">{c.items.length}</span>
                                </div>
                                <p className="note">{c.help}</p>
                                <ul className="check__items">
                                    {items.map((it, i) => (
                                        <li key={i}>
                                            {it.personId ? <Link to={`/app/players/${it.personId}`}>{it.text}</Link> : <span>{it.text}</span>}
                                            {it.merge && (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setKeep(it.merge![0]);
                                                        setMerging(it.merge!);
                                                    }}
                                                >
                                                    Merge
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                {c.items.length > SHOWN && (
                                    <button
                                        type="button"
                                        className="text-btn"
                                        onClick={() =>
                                            setOpen((s) => {
                                                const n = new Set(s);
                                                if (all) n.delete(c.id);
                                                else n.add(c.id);
                                                return n;
                                            })
                                        }
                                    >
                                        {all ? 'Show fewer' : `Show all ${c.items.length}`}
                                    </button>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            <AnimatePresence>
                {merging && (
                    <ConfirmModal
                        title="Merge two people"
                        confirmLabel={`Keep ${name(keep)}`}
                        onClose={() => setMerging(null)}
                        onConfirm={async () => {
                            const drop = merging[0] === keep ? merging[1] : merging[0];
                            const dropName = name(drop);
                            await mergePeople(data, keep, drop);
                            toast.push(`Merged ${dropName} into ${name(keep)}.`, 'success');
                            await data.refresh();
                        }}
                    >
                        <p style={{ marginBottom: 12 }}>
                            Every result, practice round and team moves to the person kept, the other is removed, and everyone is
                            recalculated. A backup is taken first, and the change log can undo it.
                        </p>
                        <fieldset className="merge-pick">
                            <legend className="note">Keep</legend>
                            {merging.map((id) => (
                                <label key={id}>
                                    <input type="radio" name="keep" checked={keep === id} onChange={() => setKeep(id)} />
                                    {name(id)} <span className="note">since {since(id)}</span>
                                </label>
                            ))}
                        </fieldset>
                    </ConfirmModal>
                )}
            </AnimatePresence>
        </Card>
    );
}

type Draft = { name: string; type: string; bonus: string; rated: boolean };
const PAGE = 20;

/** Fix many tournaments' names, types and whether they count, then save them together. */
function TournamentsCard() {
    const data = useAppData();
    const toast = useToast();
    const [q, setQ] = useState('');
    const [limit, setLimit] = useState(PAGE);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const all = useMemo(
        () => [...data.inputs.tournaments].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
        [data.inputs.tournaments]
    );
    const needle = q.trim().toLowerCase();
    const list = all.filter(
        (t) =>
            !needle ||
            (t.name ?? '').toLowerCase().includes(needle) ||
            seasonOf(t.date).includes(needle) ||
            seasonLabel(seasonOf(t.date)).includes(needle)
    );

    const original = (t: (typeof all)[number]): Draft => {
        const type = typeOfBonus(t.bonus, data.config);
        return { name: t.name ?? '', type: type ?? 'custom', bonus: t.bonus == null ? '' : String(t.bonus), rated: t.rated !== false };
    };
    const draftOf = (t: (typeof all)[number]) => drafts[t.id] ?? original(t);
    const bonusOf = (d: Draft) =>
        d.type === 'custom' ? (d.bonus.trim() === '' ? null : Number(d.bonus)) : data.config.bonuses[d.type as keyof typeof data.config.bonuses];
    const isChanged = (t: (typeof all)[number]) => {
        const d = drafts[t.id];
        if (!d) return false;
        return d.name.trim() !== (t.name ?? '') || bonusOf(d) !== t.bonus || d.rated !== (t.rated !== false);
    };
    const changedIds = all.filter(isChanged).map((t) => t.id);

    const update = (t: (typeof all)[number], patch: Partial<Draft>) =>
        setDrafts((ds) => ({ ...ds, [t.id]: { ...draftOf(t), ...patch } }));

    async function save() {
        setBusy(true);
        setError(null);
        try {
            const fixes: TournamentFix[] = changedIds.map((id) => {
                const d = drafts[id];
                return { id, name: d.name, bonus: bonusOf(d), rated: d.rated };
            });
            const n = await fixTournaments(data, fixes);
            toast.push(`Saved ${n} tournament${n === 1 ? '' : 's'}.`, 'success');
            setDrafts({});
            await data.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Couldn’t save them.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card>
            <div className="card-title">Tournaments</div>
            <p className="note card-lead">
                Fix names and types, or stop one counting toward Elo (it stays on the list). Entries and wins are edited from
                    Matches.
            </p>
            <div className="fix-toolbar">
                <input
                    className="input"
                    type="search"
                    placeholder="Search tournaments or a season (2025-26)"
                    aria-label="Search tournaments"
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setLimit(PAGE);
                    }}
                />
                <div className="row">
                    <Button disabled={!changedIds.length || busy} onClick={() => void save()}>
                        {busy ? 'Saving…' : changedIds.length ? `Save ${changedIds.length} change${changedIds.length === 1 ? '' : 's'}` : 'Save changes'}
                    </Button>
                    <Button variant="ghost" disabled={!changedIds.length || busy} onClick={() => setDrafts({})}>
                        Discard
                    </Button>
                </div>
            </div>
            {error && (
                <p className="access-error" role="alert">
                    {error}
                </p>
            )}
            <div className="fix-table" role="table" aria-label="Tournaments">
                <div className="fix-row fix-row--head" role="row">
                    <span role="columnheader">Date</span>
                    <span role="columnheader">Name</span>
                    <span role="columnheader">Type</span>
                    <span role="columnheader">Counts</span>
                </div>
                {list.slice(0, limit).map((t) => {
                    const d = draftOf(t);
                    return (
                        <div key={t.id} className={`fix-row${isChanged(t) ? ' is-changed' : ''}`} role="row">
                            <span role="cell" className="num note">
                                {t.date}
                            </span>
                            <span role="cell">
                                <input
                                    className="input"
                                    aria-label={`Name of the ${t.date} tournament`}
                                    value={d.name}
                                    onChange={(e) => update(t, { name: e.target.value })}
                                />
                            </span>
                            <span role="cell" className="fix-type">
                                <select
                                    className="select"
                                    aria-label={`Type of ${t.name ?? 'tournament'}`}
                                    value={d.type}
                                    onChange={(e) => update(t, { type: e.target.value })}
                                >
                                    {TOURNAMENT_TYPES.map((x) => (
                                        <option key={x.id} value={x.id}>
                                            {x.name} ({data.config.bonuses[x.id]})
                                        </option>
                                    ))}
                                    <option value="custom">Custom bonus</option>
                                </select>
                                {d.type === 'custom' && (
                                    <input
                                        className="input fix-bonus"
                                        inputMode="decimal"
                                        aria-label="Custom bonus"
                                        value={d.bonus}
                                        onChange={(e) => update(t, { bonus: e.target.value })}
                                    />
                                )}
                            </span>
                            <span role="cell">
                                <label className="fix-rated">
                                    <input type="checkbox" checked={d.rated} onChange={(e) => update(t, { rated: e.target.checked })} />
                                    <span className="sr-only">{t.name ?? 'This tournament'} counts toward Elo</span>
                                    <span className="fix-rated__word" aria-hidden="true">
                                        Counts
                                    </span>
                                </label>
                            </span>
                        </div>
                    );
                })}
            </div>
            {list.length > limit && (
                <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                    Show more ({list.length - limit} left)
                </Button>
            )}
        </Card>
    );
}
