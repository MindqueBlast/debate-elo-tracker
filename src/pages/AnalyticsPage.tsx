import { useMemo, useRef, useState } from 'react';
import {
    ALL_TEAMS,
    buildEloSeries,
    chartIncludes,
    chartIncludesTeam,
    classKey,
    classOf,
    competedInAny,
    previousSeason,
    type ChartWho,
    isCalendarDate,
    lookup,
    seasonLabel,
    seasonOf,
    snapshotFromSeries,
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
import { ClassPicker, type ClassChoice, type ClassShortcut } from '../components/ClassPicker';
import { EloChart } from '../components/EloChart';
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
        refresh,
    } = useAppData();
    const toast = useToast();
    const wrapRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<'people' | 'teams'>('people');
    // null = the default: the oldest class still on the team (people) or every class (teams)
    const [pickedClasses, setPickedClasses] = useState<string[] | null>(null);
    const [pickedTeamClasses, setPickedTeamClasses] = useState<string[] | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showAnnotations, setShowAnnotations] = useState(true);
    // "All individuals": everyone in each class who's still on the team, competed this season or not,
    // plus graduates
    const [allPeople, setAllPeople] = useState(false);
    // Teams: before both partners were on the team, show whoever was
    const [extendRecords, setExtendRecords] = useState(true);
    const who: ChartWho = view === 'people' && allPeople ? 'team' : 'active';
    // Individuals: anyone still on the team who competed this season or last
    const activeIds = useMemo(() => {
        if (!season) return new Set<string>();
        const recent = competedInAny(tournaments, [season, previousSeason(season)]);
        for (const d of debaters) if (d.status === 'graduated') recent.delete(d.id);
        return recent;
    }, [tournaments, season, debaters]);
    const [eventDate, setEventDate] = useState('');
    const [eventName, setEventName] = useState('');
    const [uploaded, setUploaded] = useState<ChartSeries[] | null>(null);
    // the newest ten dates show first; the rest are a click away
    const [datesShown, setDatesShown] = useState(10);

    const byId = useMemo(() => lookup(debaters), [debaters]);
    const pool = debaters.filter((d) => chartIncludes(d, who, activeIds));
    // graduates only show under All individuals
    const graduates = who === 'team' ? debaters.filter((d) => d.status === 'graduated') : [];

    // One button per season with results: July 1 through June 30
    const seasonPresets = useMemo(() => {
        const seasons = [...new Set(tournaments.map((t) => seasonOf(t.date)))].sort();
        return seasons.map((s) => {
            const y = Number(s.slice(0, 4));
            return { key: s, label: seasonLabel(s), from: `${y}-07-01`, to: `${y + 1}-06-30` };
        });
    }, [tournaments]);

    // "Class of 2027", "Class of 2028", … with how many people (or teams) each has
    const classChoices = (years: (number | null)[]): ClassChoice[] => {
        const counts = new Map<number | null, number>();
        for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
        return [...counts.entries()]
            .sort((a, b) => (a[0] ?? 9999) - (b[0] ?? 9999))
            .map(([year, count]) => ({
                key: classKey(year),
                label: year == null ? 'Class year not set' : `Class of ${year}`,
                count,
            }));
    };
    const keysOf = (cs: ClassChoice[]) => cs.map((c) => c.key);

    // People: a class with someone still on the team is current; one with only graduates
    // is a graduated class (and needs a year to be picked out)
    const currentKeys = new Set(pool.map((d) => classKey(classOf(d))));
    const peopleClasses = classChoices([...pool, ...graduates].map(classOf)).filter(
        (c) => currentKeys.has(c.key) || c.key !== classKey(null)
    );
    const currentClasses = peopleClasses.filter((c) => currentKeys.has(c.key));
    const graduatedClasses = peopleClasses.filter((c) => !currentKeys.has(c.key));
    const peopleShortcuts: ClassShortcut[] =
        graduatedClasses.length > 0
            ? [
                  { label: 'All classes', keys: keysOf(peopleClasses) },
                  { label: 'Graduated classes', keys: keysOf(graduatedClasses) },
                  { label: 'Current classes', keys: keysOf(currentClasses) },
              ]
            : [{ label: 'All classes', keys: keysOf(peopleClasses) }];

    // Teams: the classes of the people on each current team (a team counts in both partners' classes)
    const teamClasses = classChoices(
        teams
            .filter((t) => chartIncludesTeam(t, who, byId))
            .flatMap((t) => [
                ...new Set(
                    [t.member1_id, t.member2_id]
                        .map((id) => byId.get(id))
                        .filter((d) => !!d)
                        .map((d) => classOf(d!))
                ),
            ])
    );
    const teamShortcuts: ClassShortcut[] = [{ label: 'All classes', keys: keysOf(teamClasses) }];

    // What's picked, minus classes this view doesn't have (e.g. graduated ones back on Individuals);
    // if nothing picked is left, the default
    const effective = (picked: string[] | null, choices: ClassChoice[], fallback: string[]) => {
        if (picked === null) return fallback;
        const kept = picked.filter((k) => choices.some((c) => c.key === k));
        return picked.length > 0 && kept.length === 0 ? fallback : kept;
    };
    const selectedKey = (
        view === 'teams'
            ? effective(pickedTeamClasses, teamClasses, keysOf(teamClasses))
            : effective(pickedClasses, peopleClasses, currentClasses[0] ? [currentClasses[0].key] : [])
    ).join();
    // the same list from render to render while the picks don't change
    const selectedClasses = useMemo(() => (selectedKey ? selectedKey.split(',') : []), [selectedKey]);
    const exportName = `${view === 'teams' ? 'teams' : 'class'}_${
        selectedClasses.map((k) => k.slice('class:'.length)).join('_') || 'none'
    }`;

    const result = useMemo(
        () =>
            buildEloSeries({
                debaters,
                teams,
                selectedId: view === 'teams' ? ALL_TEAMS : 'ALL',
                classes: selectedClasses,
                startDate: startDate || null,
                endDate: endDate || null,
                who,
                activeIds,
                annotations,
                showAnnotations,
                tournaments,
                practiceRounds,
                extendTeams: extendRecords,
            }),
        [
            debaters,
            teams,
            tournaments,
            practiceRounds,
            view,
            selectedClasses,
            startDate,
            endDate,
            who,
            activeIds,
            annotations,
            showAnnotations,
            extendRecords,
        ]
    );

    const sortedDates = [...annotations].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div>
            <PageHeader title="Analytics" />
            <Card className="analytics-chart">
                <div className="chart-toolbar">
                    <div className="segmented" role="group" aria-label="Chart by">
                        <button
                            type="button"
                            aria-pressed={view === 'people' && !allPeople}
                            onClick={() => {
                                setView('people');
                                setAllPeople(false);
                            }}
                        >
                            Individuals
                        </button>
                        <button
                            type="button"
                            aria-pressed={view === 'people' && allPeople}
                            onClick={() => {
                                setView('people');
                                setAllPeople(true);
                            }}
                        >
                            All individuals
                        </button>
                        <button
                            type="button"
                            aria-pressed={view === 'teams'}
                            onClick={() => setView('teams')}
                        >
                            Teams<span className="wide-only"> (averaged)</span>
                        </button>
                    </div>
                    <div className="field">
                        <label htmlFor="analyticsClasses">Show</label>
                        {view === 'teams' ? (
                            <ClassPicker
                                id="analyticsClasses"
                                classes={teamClasses}
                                selected={selectedClasses}
                                shortcuts={teamShortcuts}
                                noun={['team', 'teams']}
                                onChange={setPickedTeamClasses}
                            />
                        ) : (
                            <ClassPicker
                                id="analyticsClasses"
                                classes={peopleClasses}
                                selected={selectedClasses}
                                shortcuts={peopleShortcuts}
                                onChange={setPickedClasses}
                            />
                        )}
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
                <div className="season-presets" role="group" aria-label="Season">
                    <span className="note">Season:</span>
                    {[{ key: 'all', label: 'All time', from: '', to: '' }, ...seasonPresets].map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            className="season-presets__btn"
                            aria-pressed={startDate === p.from && endDate === p.to}
                            onClick={() => {
                                setStartDate(p.from);
                                setEndDate(p.to);
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="analytics-checks">
                    <label className="row check">
                        <input
                            type="checkbox"
                            checked={showAnnotations}
                            onChange={(e) => setShowAnnotations(e.target.checked)}
                        />
                        Show important dates
                    </label>
                </div>
                <div ref={wrapRef} className="chart-fullscreen-host">
                    <EloChart
                        series={result.series}
                        yMin={result.yMin}
                        yMax={result.yMax}
                        isEmpty={result.isEmpty}
                        framed
                    />
                </div>
                <div className="row stack-top">
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
                            a.download = `${exportName}_elo_graph.png`;
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
                    {view === 'teams' && (
                        <label
                            className="row check chart-extend"
                            title="Before both partners were on the team, show whoever was"
                        >
                            <input
                                type="checkbox"
                                checked={extendRecords}
                                onChange={(e) => setExtendRecords(e.target.checked)}
                            />
                            Extend records
                        </label>
                    )}
                </div>
            </Card>
            <div className="grid grid-2 analytics-below">
                <Card>
                    <h2 className="section-heading">Important dates</h2>
                    {isAdmin && (
                        <form
                            className="date-form"
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
                        <>
                            {sortedDates.slice(0, datesShown).map((a) => (
                                <div key={a.id} className="date-row">
                                    <span className="num">{a.date}</span>
                                    <span>{a.name}</span>
                                    {isAdmin && (
                                        <span className="date-row__actions">
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
                            ))}
                            {sortedDates.length > datesShown && (
                                <div className="pagination">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setDatesShown(sortedDates.length)}
                                    >
                                        Show all ({sortedDates.length - datesShown} more)
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </Card>
                <Card>
                    <h2 className="section-heading">Load a saved snapshot</h2>
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
                        <div className="stack-top">
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
    );
}
