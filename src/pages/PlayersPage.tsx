import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import {
    BASE_ELO,
    getLocalDateString,
    lookup,
    parseEloInput,
    seasonOf,
    rankDebaters,
    rankTeams,
    type Debater,
    type Division,
    type Team,
} from '../domain';
import {
    addDebater,
    createTeam,
    deleteAdjustment,
    deleteTeam,
    MutationError,
    removeDebater,
    setDebaterElo,
    toggleGraduate,
    updateDebater,
    updateTeam,
} from '../data/mutations';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { Modal } from '../components/Modal';
import { EmptyRoster } from '../components/illustrations';
import { useAppData } from '../state/AppDataProvider';
import { useToast } from '../state/ToastProvider';

const DIVS: Division[] = ['Varsity', 'JV', 'Novice'];

/** This season's four classes, seniors first, e.g. 2027–2030 in 2026–27. */
function currentClasses(): { year: number; label: string }[] {
    const start = Number(seasonOf(getLocalDateString()).slice(0, 4));
    return ['Senior', 'Junior', 'Sophomore', 'Freshman'].map((label, i) => ({
        year: start + 1 + i,
        label,
    }));
}

const shortClass = (year: number) => `’${String(year).slice(2)}`;

const errorText = (err: unknown, fallback: string) =>
    err instanceof MutationError ? err.message : fallback;

export function PlayersPage() {
    const [tab, setTab] = useState<'people' | 'teams'>('people');
    return (
        <div>
            <PageHeader
                kicker="Roster"
                title="Players"
                illustration={<EmptyRoster size={72} tone="accent" />}
                actions={
                    <div className="segmented" role="group" aria-label="Show">
                        <button
                            type="button"
                            aria-pressed={tab === 'people'}
                            onClick={() => setTab('people')}
                        >
                            People
                        </button>
                        <button
                            type="button"
                            aria-pressed={tab === 'teams'}
                            onClick={() => setTab('teams')}
                        >
                            Teams
                        </button>
                    </div>
                }
            />
            {tab === 'people' ? <People /> : <Teams />}
        </div>
    );
}

function People() {
    const { isAdmin } = useAuth();
    const data = useAppData();
    const { debaters, teams, practiceRounds, tournaments, adjustments, refresh } = data;
    const toast = useToast();
    const [q, setQ] = useState('');
    const [showGraduated, setShowGraduated] = useState(false);
    const [name, setName] = useState('');
    const [division, setDivision] = useState<Division>('Novice');
    const [elo, setElo] = useState('');
    const [classPick, setClassPick] = useState('');
    const [classOther, setClassOther] = useState('');
    const classes = currentClasses();
    const [editing, setEditing] = useState<Debater | null>(null);
    const [eloTarget, setEloTarget] = useState<Debater | null>(null);
    const [eloValue, setEloValue] = useState('');
    const [eloNote, setEloNote] = useState('');
    const [busy, setBusy] = useState(false);
    const resultCount = (id: string) =>
        tournaments.reduce(
            (n, t) =>
                n + t.tournament_participants.filter((p) => p.debater_id === id || p.partner_id === id).length,
            0
        );

    const ranked = useMemo(
        () => rankDebaters(debaters, practiceRounds, { showGraduated, search: q }),
        [debaters, practiceRounds, showGraduated, q]
    );
    const teamCount = useMemo(() => {
        const counts = new Map<string, number>();
        for (const t of teams) {
            if (!t.active) continue;
            for (const id of [t.member1_id, t.member2_id]) {
                counts.set(id, (counts.get(id) ?? 0) + 1);
            }
        }
        return counts;
    }, [teams]);

    async function onAdd(e: React.FormEvent) {
        e.preventDefault();
        const parsed = parseEloInput(elo, BASE_ELO[division]);
        if (parsed == null) {
            toast.push('Starting Elo must be a number.', 'warning');
            return;
        }
        const classYear = Number(classPick === 'other' ? classOther : classPick);
        if (!classPick || !Number.isInteger(classYear) || classYear < 2000 || classYear > 2100) {
            toast.push('Pick their class year (the year they graduate).', 'warning');
            return;
        }
        try {
            await addDebater(data, { name, division, startingElo: parsed, classYear });
            setName('');
            setElo('');
            setClassPick('');
            setClassOther('');
            toast.push(`Added ${name.trim()} at ${Math.round(parsed)}.`, 'success');
            await refresh();
        } catch (err) {
            toast.push(errorText(err, 'Failed to add person.'), 'error');
        }
    }

    return (
        <>
            {isAdmin && (
                <Card style={{ marginBottom: 20 }}>
                    <form onSubmit={(e) => void onAdd(e)} className="grid grid-5">
                        <div className="field">
                            <label htmlFor="personName">Name</label>
                            <input
                                id="personName"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="personDivision">Division</label>
                            <select
                                id="personDivision"
                                value={division}
                                onChange={(e) => setDivision(e.target.value as Division)}
                            >
                                {DIVS.map((d) => (
                                    <option key={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="personClass">Class of</label>
                            <select
                                id="personClass"
                                value={classPick}
                                required
                                onChange={(e) => setClassPick(e.target.value)}
                            >
                                <option value="">Pick…</option>
                                {classes.map((c) => (
                                    <option key={c.year} value={c.year}>
                                        {c.year} ({c.label.toLowerCase()})
                                    </option>
                                ))}
                                <option value="other">Other…</option>
                            </select>
                            {classPick === 'other' && (
                                <input
                                    aria-label="Class year"
                                    inputMode="numeric"
                                    placeholder="e.g. 2031"
                                    value={classOther}
                                    onChange={(e) => setClassOther(e.target.value)}
                                    style={{ marginTop: 6 }}
                                />
                            )}
                        </div>
                        <div className="field">
                            <label htmlFor="personElo">Starting Elo</label>
                            <input
                                id="personElo"
                                inputMode="decimal"
                                placeholder={String(BASE_ELO[division])}
                                value={elo}
                                onChange={(e) => setElo(e.target.value)}
                            />
                        </div>
                        <div className="field" style={{ justifyContent: 'end' }}>
                            <label>&nbsp;</label>
                            <Button type="submit">Add person</Button>
                        </div>
                    </form>
                    <p className="note">
                        New people start at {BASE_ELO.Novice} (Novice), {BASE_ELO.JV} (JV) or{' '}
                        {BASE_ELO.Varsity} (Varsity) unless you enter a number. Class of = the year
                        they graduate (the first two digits of their student ID).
                    </p>
                </Card>
            )}
            <div className="toolbar">
                <input
                    className="input"
                    placeholder="Search…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <label className="row check" style={{ marginBottom: 0 }}>
                    <input
                        type="checkbox"
                        checked={showGraduated}
                        onChange={(e) => setShowGraduated(e.target.checked)}
                    />
                    Show graduated
                </label>
            </div>
            <Card>
                {ranked.length === 0 ? (
                    <EmptyState
                        title="No people"
                        body="Add someone to the roster."
                        illustration={<EmptyRoster size={80} />}
                    />
                ) : (
                    ranked.map((d) => (
                        <div key={d.id} className="player-row">
                            <span className="num">#{d.rank}</span>
                            <Link to={`/app/players/${d.id}`}>
                                <strong>{d.name}</strong>
                            </Link>
                            {d.division && <span className="pill">{d.division}</span>}
                            {d.class_year != null && (
                                <span className="pill" title={`Class of ${d.class_year}`}>
                                    {shortClass(d.class_year)}
                                </span>
                            )}
                            {d.status === 'graduated' && <span className="pill">graduated</span>}
                            {d.status === 'active' && !teamCount.get(d.id) && (
                                <span className="pill" title="Not on an active team">
                                    no team
                                </span>
                            )}
                            <span className="elo">{Math.round(d.elo)}</span>
                            {isAdmin && (
                                <span className="row">
                                    <Button size="sm" variant="secondary" onClick={() => setEditing(d)}>
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            setEloTarget(d);
                                            setEloValue(String(Math.round(d.elo)));
                                            setEloNote('');
                                        }}
                                    >
                                        Set Elo
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={busy}
                                        onClick={async () => {
                                            setBusy(true);
                                            try {
                                                await toggleGraduate(data, d);
                                                toast.push('Status updated.', 'success');
                                                await refresh();
                                            } catch (err) {
                                                toast.push(errorText(err, 'Failed to update.'), 'error');
                                            } finally {
                                                setBusy(false);
                                            }
                                        }}
                                    >
                                        {d.status === 'active' ? 'Graduate' : 'Reactivate'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        disabled={busy}
                                        onClick={async () => {
                                            const n = resultCount(d.id);
                                            const message =
                                                n === 0
                                                    ? `Permanently remove ${d.name}?`
                                                    : `Permanently remove ${d.name} and their ${n} tournament result${n === 1 ? '' : 's'}? ` +
                                                      'Partners keep their shared results (partner left blank), ' +
                                                      'and everyone is recalculated without them.';
                                            if (!confirm(message)) return;
                                            setBusy(true);
                                            try {
                                                await removeDebater(data, d.id);
                                                toast.push(`${d.name} removed. Everyone was recalculated.`, 'success');
                                                await refresh();
                                            } catch (err) {
                                                toast.push(errorText(err, 'Failed to remove.'), 'error');
                                            } finally {
                                                setBusy(false);
                                            }
                                        }}
                                    >
                                        Remove
                                    </Button>
                                </span>
                            )}
                        </div>
                    ))
                )}
            </Card>
            <AnimatePresence>
                {editing && (
                    <EditPerson
                        key="edit-person"
                        debater={editing}
                        onClose={() => setEditing(null)}
                    />
                )}
                {eloTarget && (
                    <Modal key="set-elo" title={`Set Elo · ${eloTarget.name}`} onClose={() => setEloTarget(null)}>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const parsed = parseEloInput(eloValue, NaN);
                                if (parsed == null || Number.isNaN(parsed)) {
                                    toast.push('Enter a valid Elo.', 'warning');
                                    return;
                                }
                                setBusy(true);
                                try {
                                    await setDebaterElo(data, eloTarget, parsed, eloNote);
                                    toast.push(`Elo set to ${parsed}.`, 'success');
                                    setEloTarget(null);
                                    await refresh();
                                } catch (err) {
                                    toast.push(errorText(err, 'Failed to set Elo.'), 'error');
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            <p className="note" style={{ marginBottom: 12 }}>
                                Now {Math.round(eloTarget.elo)}. This saves a one-off adjustment today
                                (the difference), so it stays in place whenever results are recalculated.
                            </p>
                            <div className="field">
                                <label htmlFor="newElo">New Elo</label>
                                <input
                                    id="newElo"
                                    value={eloValue}
                                    onChange={(e) => setEloValue(e.target.value)}
                                />
                            </div>
                            <div className="field">
                                <label htmlFor="eloNote">Reason (optional)</label>
                                <input
                                    id="eloNote"
                                    value={eloNote}
                                    onChange={(e) => setEloNote(e.target.value)}
                                />
                            </div>
                            <Button type="submit" disabled={busy}>
                                Save
                            </Button>
                        </form>
                        {adjustments.some((a) => a.debater_id === eloTarget.id) && (
                            <div style={{ marginTop: 20 }}>
                                <div className="stat-label">Earlier adjustments</div>
                                {adjustments
                                    .filter((a) => a.debater_id === eloTarget.id)
                                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                                    .map((a) => (
                                        <div key={a.id} className="match-row">
                                            <span className="num">{a.date}</span>
                                            <span>
                                                <span className={a.amount < 0 ? 'delta-neg' : 'delta-pos'}>
                                                    {a.amount >= 0 ? '+' : ''}
                                                    {a.amount.toFixed(1)}
                                                </span>
                                                {a.note && <span className="note"> · {a.note}</span>}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                disabled={busy}
                                                onClick={async () => {
                                                    setBusy(true);
                                                    try {
                                                        await deleteAdjustment(data, a.id);
                                                        toast.push('Adjustment removed.', 'success');
                                                        setEloTarget(null);
                                                        await refresh();
                                                    } catch (err) {
                                                        toast.push(errorText(err, 'Failed to remove.'), 'error');
                                                    } finally {
                                                        setBusy(false);
                                                    }
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </>
    );
}

function EditPerson({ debater, onClose }: { debater: Debater; onClose: () => void }) {
    const data = useAppData();
    const { refresh } = data;
    const toast = useToast();
    const [name, setName] = useState(debater.name);
    const [division, setDivision] = useState<Division | ''>(debater.division ?? '');
    const [classYear, setClassYear] = useState(
        debater.class_year == null ? '' : String(debater.class_year)
    );
    const [startElo, setStartElo] = useState(String(debater.start_elo));
    const [startDate, setStartDate] = useState(debater.start_date);
    const [saving, setSaving] = useState(false);
    return (
        <Modal title={`Edit ${debater.name}`} onClose={onClose}>
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    const elo = parseEloInput(startElo, NaN);
                    if (elo == null || Number.isNaN(elo)) {
                        toast.push('Starting Elo must be a number.', 'warning');
                        return;
                    }
                    const year = classYear.trim() === '' ? null : Number(classYear);
                    if (year != null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
                        toast.push('Class year should look like 2027.', 'warning');
                        return;
                    }
                    setSaving(true);
                    try {
                        await updateDebater(data, debater, {
                            name,
                            division: division || null,
                            classYear: year,
                            startElo: elo,
                            startDate,
                        });
                        toast.push('Saved. Everyone was recalculated.', 'success');
                        onClose();
                        await refresh();
                    } catch (err) {
                        toast.push(errorText(err, 'Failed to save.'), 'error');
                    } finally {
                        setSaving(false);
                    }
                }}
            >
                <div className="field">
                    <label htmlFor="editName">Name</label>
                    <input id="editName" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                    <label htmlFor="editDivision">Division</label>
                    <select
                        id="editDivision"
                        value={division}
                        onChange={(e) => setDivision(e.target.value as Division | '')}
                    >
                        <option value="">—</option>
                        {DIVS.map((d) => (
                            <option key={d}>{d}</option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label htmlFor="editClass">Class of</label>
                    <input
                        id="editClass"
                        inputMode="numeric"
                        placeholder="e.g. 2027"
                        value={classYear}
                        onChange={(e) => setClassYear(e.target.value)}
                    />
                </div>
                <div className="grid grid-2 tight">
                    <div className="field">
                        <label htmlFor="editStartElo">Starting Elo</label>
                        <input
                            id="editStartElo"
                            inputMode="decimal"
                            value={startElo}
                            onChange={(e) => setStartElo(e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="editStartDate">Start date</label>
                        <input
                            id="editStartDate"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                </div>
                <p className="note" style={{ marginBottom: 12 }}>
                    Their Elo is worked out from this starting point through every result, so
                    changing it updates everything after.
                </p>
                <Button type="submit" disabled={saving}>
                    Save
                </Button>
            </form>
        </Modal>
    );
}

function Teams() {
    const { isAdmin } = useAuth();
    const { debaters, teams, refresh } = useAppData();
    const toast = useToast();
    const byId = useMemo(() => lookup(debaters), [debaters]);
    const active = useMemo(
        () =>
            debaters
                .filter((d) => d.status === 'active')
                .sort((a, b) => a.name.localeCompare(b.name)),
        [debaters]
    );
    const [q, setQ] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [members, setMembers] = useState<[string, string]>(['', '']);
    const [name, setName] = useState('');
    const [division, setDivision] = useState<Division | ''>('');
    const [editing, setEditing] = useState<Team | null>(null);

    const ranked = useMemo(
        () => rankTeams(teams, debaters, { showInactive, search: q }),
        [teams, debaters, showInactive, q]
    );
    const onActiveTeam = new Set(
        teams.filter((t) => t.active).flatMap((t) => [t.member1_id, t.member2_id])
    );

    return (
        <>
            {isAdmin && (
                <Card style={{ marginBottom: 20 }}>
                    <form
                        className="grid grid-5"
                        onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                await createTeam({
                                    members,
                                    name,
                                    division: division || null,
                                    teams,
                                });
                                setMembers(['', '']);
                                setName('');
                                setDivision('');
                                toast.push('Team saved.', 'success');
                                await refresh();
                            } catch (err) {
                                toast.push(errorText(err, 'Failed to save the team.'), 'error');
                            }
                        }}
                    >
                        {[0, 1].map((slot) => (
                            <div className="field" key={slot}>
                                <label htmlFor={`teamMember${slot}`}>
                                    {slot === 0 ? 'Person 1' : 'Person 2'}
                                </label>
                                <select
                                    id={`teamMember${slot}`}
                                    value={members[slot]}
                                    onChange={(e) => {
                                        const next: [string, string] = [...members];
                                        next[slot] = e.target.value;
                                        setMembers(next);
                                    }}
                                >
                                    <option value="">Select…</option>
                                    {active.map((d) => (
                                        <option
                                            key={d.id}
                                            value={d.id}
                                            disabled={d.id === members[1 - slot]}
                                        >
                                            {d.name}
                                            {onActiveTeam.has(d.id) ? '' : ' · no team'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                        <div className="field">
                            <label htmlFor="teamDivision">Division</label>
                            <select
                                id="teamDivision"
                                value={division}
                                onChange={(e) => setDivision(e.target.value as Division | '')}
                            >
                                <option value="">—</option>
                                {DIVS.map((d) => (
                                    <option key={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="teamName">Name (optional)</label>
                            <input
                                id="teamName"
                                placeholder="e.g. Jiayi+Leon"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="field" style={{ justifyContent: 'end' }}>
                            <label>&nbsp;</label>
                            <Button type="submit">Save team</Button>
                        </div>
                    </form>
                    <p className="note">
                        Teams are just saved partnerships for quick entry and the team
                        rankings. A team’s Elo is the average of its two people, and every
                        result counts for each person, whoever they debated with.
                    </p>
                </Card>
            )}
            <div className="toolbar">
                <input
                    className="input"
                    placeholder="Search teams or people…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <label className="row check" style={{ marginBottom: 0 }}>
                    <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                    />
                    Show past teams
                </label>
            </div>
            <Card>
                {ranked.length === 0 ? (
                    <EmptyState
                        title="No teams"
                        body="Save a partnership to see it here."
                        illustration={<EmptyRoster size={80} />}
                    />
                ) : (
                    ranked.map((r) => (
                        <div key={r.team.id} className={`team-row ${r.rank <= 3 && r.team.active ? `rank-${r.rank}` : ''}`}>
                            <span className="num">#{r.rank}</span>
                            <div>
                                <strong>{r.name}</strong>
                                <div className="team-row__members">
                                    {r.members.map((m, i) => (
                                        <span key={m.id}>
                                            {i > 0 && ' · '}
                                            <Link to={`/app/players/${m.id}`}>
                                                {m.name} {Math.round(m.elo)}
                                            </Link>
                                        </span>
                                    ))}
                                    {r.team.season && ` · ${r.team.season}`}
                                </div>
                            </div>
                            <span className="chips">
                                {r.team.division && <span className="pill">{r.team.division}</span>}
                                {!r.team.active && <span className="pill">past</span>}
                            </span>
                            <span className="elo" style={{ textAlign: 'right' }}>
                                {Math.round(r.elo)}
                            </span>
                            {isAdmin && (
                                <span className="row team-row__actions">
                                    <Button size="sm" variant="secondary" onClick={() => setEditing(r.team)}>
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={async () => {
                                            try {
                                                await updateTeam(r.team, { active: !r.team.active }, teams);
                                                await refresh();
                                            } catch (err) {
                                                toast.push(errorText(err, 'Failed to update.'), 'error');
                                            }
                                        }}
                                    >
                                        {r.team.active ? 'Retire team' : 'Make active'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={async () => {
                                            if (
                                                !confirm(
                                                    `Delete ${r.name}? Past results stay on each person's record.`
                                                )
                                            )
                                                return;
                                            try {
                                                await deleteTeam(r.team);
                                                await refresh();
                                            } catch (err) {
                                                toast.push(errorText(err, 'Failed to delete.'), 'error');
                                            }
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </span>
                            )}
                        </div>
                    ))
                )}
            </Card>
            <AnimatePresence>
                {editing && (
                    <EditTeam
                        key="edit-team"
                        team={editing}
                        people={debaters
                            .filter(
                                (d) =>
                                    d.status === 'active' ||
                                    d.id === editing.member1_id ||
                                    d.id === editing.member2_id
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))}
                        byName={(id) => byId.get(id)?.name ?? 'Unknown'}
                        onClose={() => setEditing(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

function EditTeam({
    team,
    people,
    onClose,
}: {
    team: Team;
    people: Debater[];
    byName: (id: string) => string;
    onClose: () => void;
}) {
    const { teams, refresh } = useAppData();
    const toast = useToast();
    const [members, setMembers] = useState<[string, string]>([team.member1_id, team.member2_id]);
    const [name, setName] = useState(team.name ?? '');
    const [division, setDivision] = useState<Division | ''>(team.division ?? '');
    return (
        <Modal title="Edit team" onClose={onClose}>
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                        await updateTeam(
                            team,
                            { members, name, division: division || null },
                            teams
                        );
                        toast.push('Team saved.', 'success');
                        onClose();
                        await refresh();
                    } catch (err) {
                        toast.push(errorText(err, 'Failed to save.'), 'error');
                    }
                }}
            >
                {[0, 1].map((slot) => (
                    <div className="field" key={slot}>
                        <label htmlFor={`editMember${slot}`}>
                            {slot === 0 ? 'Person 1' : 'Person 2'}
                        </label>
                        <select
                            id={`editMember${slot}`}
                            value={members[slot]}
                            onChange={(e) => {
                                const next: [string, string] = [...members];
                                next[slot] = e.target.value;
                                setMembers(next);
                            }}
                        >
                            {people.map((d) => (
                                <option key={d.id} value={d.id} disabled={d.id === members[1 - slot]}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
                <div className="field">
                    <label htmlFor="editTeamName">Name</label>
                    <input
                        id="editTeamName"
                        placeholder="Leave blank to use the two names"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="field">
                    <label htmlFor="editTeamDivision">Division</label>
                    <select
                        id="editTeamDivision"
                        value={division}
                        onChange={(e) => setDivision(e.target.value as Division | '')}
                    >
                        <option value="">—</option>
                        {DIVS.map((d) => (
                            <option key={d}>{d}</option>
                        ))}
                    </select>
                </div>
                <p className="note" style={{ marginBottom: 12 }}>
                    Changing who’s on a team only changes the list. Past results stay with
                    the people who earned them.
                </p>
                <Button type="submit">Save</Button>
            </form>
        </Modal>
    );
}
