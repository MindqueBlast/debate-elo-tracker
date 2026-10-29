import { useMemo, useRef, useState } from 'react';
import {
    ALL_TEAMS,
    buildEloSeries,
    classKey,
    isClassKey,
    isCalendarDate,
    lookup,
    seasonLabel,
    snapshotFromSeries,
    teamElo,
    teamKey,
    teamName,
    type Team,
} from '../domain';
import {
    addAnnotation,
    editAnnotationDate,
    MutationError,
    removeAnnotation,
} from '../data/mutations';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Card, EmptyState, PageHeader } from '../components/Card';
import { EloChart } from '../components/EloChart';
import { ScalesMotif } from '../components/illustrations';
import { useAppData } from '../state/AppDataProvider';
import { useToast } from '../state/ToastProvider';
import type { ChartSeries } from '../domain';

export function AnalyticsPage() {
    const { isAdmin } = useAuth();
    const {
        debaters,
        teams,
        annotations,
        tournaments,
        practiceRounds,
        season,
        activeIds,
        refresh,
    } = useAppData();
    const toast = useToast();
    const wrapRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<'people' | 'teams'>('people');
    // '' = the default: the oldest class still on the team
    const [chosenId, setSelectedId] = useState('');
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showAnnotations, setShowAnnotations] = useState(true);
    // Off = only people who competed in the latest season, and teams that haven't disbanded
    const [showGraduated, setShowGraduated] = useState(false);
    const [eventDate, setEventDate] = useState('');
    const [eventName, setEventName] = useState('');
    const [uploaded, setUploaded] = useState<ChartSeries[] | null>(null);

    const pool = debaters
        .filter((d) => showGraduated || activeIds.has(d.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    const byId = useMemo(() => lookup(debaters), [debaters]);

    // "Class of 2027", "Class of 2028", … for everyone listed (plus anyone with no year set)
    const classOptions = useMemo(() => {
        const counts = new Map<number | null, number>();
        for (const d of pool) {
            const y = d.class_year ?? null;
            counts.set(y, (counts.get(y) ?? 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => (a[0] ?? 9999) - (b[0] ?? 9999))
            .map(([year, count]) => ({
                key: classKey(year),
                label: year == null ? 'Class year not set' : `Class of ${year}`,
                count,
            }));
    }, [pool]);
    const defaultSelection = classOptions[0]?.key ?? 'ALL';
    // a class that's no longer listed (e.g. graduated people hidden) falls back to the default
    const selectedId =
        !chosenId || (isClassKey(chosenId) && !classOptions.some((c) => c.key === chosenId))
            ? view === 'teams'
                ? ALL_TEAMS
                : defaultSelection
            : chosenId;
    const teamPool = useMemo(
        () =>
            teams
                .filter((t) => showGraduated || t.active)
                .map((t) => ({
                    key: teamKey(t.id),
                    name: teamName(t, byId),
                    elo: teamElo(t, byId),
                }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [teams, showGraduated, byId]
    );

    // A person's team: their current one if they have it, else their latest
    const teamFor = (personId: string): Team | undefined => {
        const theirs = teams.filter(
            (t) => t.member1_id === personId || t.member2_id === personId
        );
        return theirs.find((t) => t.active) ?? theirs[theirs.length - 1];
    };

    // Switching keeps the same people on screen where it can:
    // Jiayi vs Leon <-> their team, a team <-> its two members
    const switchView = (next: 'people' | 'teams') => {
        if (next === view) return;
        if (next === 'teams') {
            const a = selectedId === 'ALL' || isClassKey(selectedId) ? undefined : teamFor(selectedId);
            const others = compareIds
                .map((id) => teamFor(id))
                .filter((t): t is Team => !!t && t.id !== a?.id)
                .map((t) => teamKey(t.id));
            setSelectedId(a ? teamKey(a.id) : ALL_TEAMS);
            setCompareIds(a ? [...new Set(others)] : []);
        } else {
            const teamOf = (key: string) => teams.find((t) => teamKey(t.id) === key);
            const team = teamOf(selectedId);
            const people = [selectedId, ...compareIds]
                .map(teamOf)
                .flatMap((t) => (t ? [t.member1_id, t.member2_id] : []));
            setSelectedId(team ? team.member1_id : '');
            setCompareIds(team ? [...new Set(people)].filter((id) => id !== team.member1_id) : []);
        }
        setView(next);
    };
    const isGroup = selectedId === 'ALL' || selectedId === ALL_TEAMS || isClassKey(selectedId);
    const selectedName =
        selectedId === 'ALL'
            ? 'all_people'
            : isClassKey(selectedId)
              ? `class_of_${selectedId.slice('class:'.length)}`
              : selectedId === ALL_TEAMS
                ? 'all_teams'
              : (teamPool.find((t) => t.key === selectedId)?.name ??
                debaters.find((d) => d.id === selectedId)?.name ??
                'elo');

    const result = useMemo(
        () =>
            buildEloSeries({
                debaters,
                teams,
                selectedId,
                compareIds: isGroup ? [] : compareIds,
                startDate: startDate || null,
                endDate: endDate || null,
                showGraduated,
                activeIds,
                annotations,
                showAnnotations,
                tournaments,
                practiceRounds,
            }),
        [
            debaters,
            teams,
            tournaments,
            practiceRounds,
            isGroup,
            selectedId,
            compareIds,
            startDate,
            endDate,
            showGraduated,
            activeIds,
            annotations,
            showAnnotations,
        ]
    );

    return (
        <div>
            <PageHeader
                kicker="Charts"
                title="Analytics"
                illustration={<ScalesMotif size={72} tone="accent" />}
            />
            <div className="grid grid-2">
                <Card>
                    <div className="segmented" role="group" aria-label="Chart by" style={{ marginBottom: 16 }}>
                        <button
                            type="button"
                            aria-pressed={view === 'people'}
                            onClick={() => switchView('people')}
                        >
                            Individuals
                        </button>
                        <button
                            type="button"
                            aria-pressed={view === 'teams'}
                            onClick={() => switchView('teams')}
                        >
                            Teams (averaged)
                        </button>
                    </div>
                    <div className="chart-toolbar">
                        <div className="field">
                            <label htmlFor="analyticsDebater">Show</label>
                            <select
                                id="analyticsDebater"
                                value={selectedId}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setSelectedId(next);
                                    setCompareIds((ids) =>
                                        next === 'ALL' || next === ALL_TEAMS || isClassKey(next)
                                            ? []
                                            : ids.filter((id) => id !== next)
                                    );
                                }}
                            >
                                {view === 'people' ? (
                                    <>
                                        <optgroup label="Classes">
                                            <option value="ALL">All classes ({pool.length})</option>
                                            {classOptions.map((c) => (
                                                <option key={c.key} value={c.key}>
                                                    {c.label} ({c.count})
                                                </option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="People">
                                            {pool.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name} ({Math.round(d.elo)})
                                                </option>
                                            ))}
                                        </optgroup>
                                    </>
                                ) : (
                                    <>
                                        <option value={ALL_TEAMS}>
                                            {showGraduated ? 'All teams' : 'All current teams'}
                                        </option>
                                        {teamPool.map((t) => (
                                            <option key={t.key} value={t.key}>
                                                {t.name} ({Math.round(t.elo)})
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="compareDebater">Compare with</label>
                            <select
                                id="compareDebater"
                                value=""
                                disabled={isGroup}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    if (id) setCompareIds((ids) => [...ids, id]);
                                }}
                            >
                                <option value="">
                                    {isGroup
                                        ? 'Pick one to compare'
                                        : compareIds.length
                                          ? 'Add another…'
                                          : view === 'people'
                                            ? 'Add a person…'
                                            : 'Add a team…'}
                                </option>
                                {view === 'people'
                                    ? pool
                                          .filter((d) => d.id !== selectedId && !compareIds.includes(d.id))
                                          .map((d) => (
                                              <option key={d.id} value={d.id}>
                                                  {d.name}
                                              </option>
                                          ))
                                    : teamPool
                                          .filter((t) => t.key !== selectedId && !compareIds.includes(t.key))
                                          .map((t) => (
                                              <option key={t.key} value={t.key}>
                                                  {t.name}
                                              </option>
                                          ))}
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="from">From</label>
                            <input
                                id="from"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="to">To</label>
                            <input
                                id="to"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    {!isGroup && compareIds.length > 0 && (
                        <div className="chips compare-chips">
                            <span className="note">Comparing:</span>
                            {compareIds.map((id) => {
                                const name =
                                    teamPool.find((t) => t.key === id)?.name ??
                                    (() => {
                                        const team = teams.find((t) => teamKey(t.id) === id);
                                        return team ? teamName(team, byId) : undefined;
                                    })() ??
                                    byId.get(id)?.name ??
                                    'Unknown';
                                return (
                                    <span key={id} className="pill pill-removable">
                                        {name}
                                        <button
                                            type="button"
                                            aria-label={`Stop comparing ${name}`}
                                            onClick={() =>
                                                setCompareIds((ids) => ids.filter((x) => x !== id))
                                            }
                                        >
                                            ×
                                        </button>
                                    </span>
                                );
                            })}
                            {compareIds.length > 1 && (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setCompareIds([])}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                    <label className="row" style={{ marginBottom: 12 }}>
                        <input
                            type="checkbox"
                            checked={showAnnotations}
                            onChange={(e) => setShowAnnotations(e.target.checked)}
                        />
                        Show important dates
                    </label>
                    <label className="row" style={{ marginBottom: 12 }}>
                        <input
                            type="checkbox"
                            checked={!showGraduated}
                            onChange={(e) => setShowGraduated(!e.target.checked)}
                        />
                        Show active only{season ? ` (competed in ${seasonLabel(season)})` : ''} and
                        current teams
                    </label>
                    <div ref={wrapRef} className="chart-fullscreen-host">
                        <EloChart
                            series={result.series}
                            yMin={result.yMin}
                            yMax={result.yMax}
                            isEmpty={result.isEmpty}
                            framed
                        />
                    </div>
                    <div className="row" style={{ marginTop: 12 }}>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => wrapRef.current?.requestFullscreen?.()}
                        >
                            Fullscreen
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                const canvas = wrapRef.current?.querySelector('canvas');
                                if (!canvas) return;
                                const a = document.createElement('a');
                                a.download = `${selectedName.replace(/[^\w+-]+/g, '_')}_elo_graph.png`;
                                a.href = canvas.toDataURL('image/png');
                                a.click();
                            }}
                        >
                            Export PNG
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                const payload = snapshotFromSeries(result.series);
                                const blob = new Blob(
                                    [JSON.stringify(payload, null, 2)],
                                    { type: 'application/json' }
                                );
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'chart_export.json';
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            Export JSON
                        </Button>
                    </div>
                </Card>
                <div>
                    <Card>
                        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
                            Important dates
                        </h2>
                        {isAdmin && (
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    try {
                                        await addAnnotation(eventDate, eventName);
                                        setEventDate('');
                                        setEventName('');
                                        await refresh();
                                    } catch (err) {
                                        toast.push(
                                            err instanceof MutationError
                                                ? err.message
                                                : 'Failed to add date.',
                                            'error'
                                        );
                                    }
                                }}
                            >
                                <div className="field">
                                    <label htmlFor="eventDate">Date</label>
                                    <input
                                        id="eventDate"
                                        type="date"
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                    />
                                </div>
                                <div className="field">
                                    <label htmlFor="eventName">Name</label>
                                    <input
                                        id="eventName"
                                        value={eventName}
                                        onChange={(e) => setEventName(e.target.value)}
                                    />
                                </div>
                                <Button type="submit" size="sm">
                                    Mark date
                                </Button>
                            </form>
                        )}
                        {annotations.length === 0 ? (
                            <EmptyState
                                title="No marked dates"
                                body="Important dates appear as markers on the chart."
                            />
                        ) : (
                            [...annotations]
                                .sort((a, b) => b.date.localeCompare(a.date))
                                .map((a) => (
                                    <div key={a.id} className="match-row">
                                        <span className="num">{a.date}</span>
                                        <span>{a.name}</span>
                                        {isAdmin && (
                                            <span className="row">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={async () => {
                                                        const next = prompt(
                                                            'New date (YYYY-MM-DD)',
                                                            a.date
                                                        );
                                                        if (!next) return;
                                                        if (!isCalendarDate(next)) {
                                                            toast.push(
                                                                'Use YYYY-MM-DD.',
                                                                'warning'
                                                            );
                                                            return;
                                                        }
                                                        await editAnnotationDate(a.id, next);
                                                        await refresh();
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={async () => {
                                                        if (!confirm('Remove this date?'))
                                                            return;
                                                        await removeAnnotation(a.id);
                                                        await refresh();
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
                    <Card style={{ marginTop: 16 }}>
                        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
                            Load a saved snapshot
                        </h2>
                        <input
                            type="file"
                            accept=".json"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                    const parsed = JSON.parse(await file.text());
                                    const rows = Array.isArray(parsed)
                                        ? parsed
                                        : [parsed];
                                    setUploaded(
                                        rows.map(
                                            (
                                                entry: {
                                                    id?: string;
                                                    name?: string;
                                                    history?: {
                                                        date: string;
                                                        elo: number;
                                                    }[];
                                                },
                                                i: number
                                            ) => ({
                                                id: String(entry.id ?? i),
                                                label: entry.name || `Series ${i + 1}`,
                                                data: (entry.history || []).map(
                                                    (p) => ({
                                                        x: String(p.date).slice(0, 10),
                                                        y: p.elo,
                                                    })
                                                ),
                                            })
                                        )
                                    );
                                } catch {
                                    toast.push('Invalid JSON file.', 'error');
                                }
                            }}
                        />
                        {uploaded && (
                            <div style={{ marginTop: 12 }}>
                                <EloChart
                                    series={uploaded}
                                    yMin={null}
                                    yMax={null}
                                    isEmpty={uploaded.every((s) => s.data.length === 0)}
                                />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
