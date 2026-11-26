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
    isClassKey,
    isCalendarDate,
    lookup,
    seasonLabel,
    seasonOf,
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
    // '' = the default: the oldest class still on the team
    const [chosenId, setSelectedId] = useState('');
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showAnnotations, setShowAnnotations] = useState(true);
    // "All individuals": everyone in each class who's still on the team, competed this season or not,
    // with graduates listed separately
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

    const pool = debaters
        .filter((d) => chartIncludes(d, who, activeIds))
        .sort((a, b) => a.name.localeCompare(b.name));
    const byId = useMemo(() => lookup(debaters), [debaters]);
    // graduates only show under All individuals, in their own groups
    const graduates = useMemo(
        () =>
            who === 'team'
                ? debaters
                      .filter((d) => d.status === 'graduated')
                      .sort((a, b) => a.name.localeCompare(b.name))
                : [],
        [debaters, who]
    );
    const listed = [...pool, ...graduates];


    // One button per season with results: July 1 through June 30
    const seasonPresets = useMemo(() => {
        const seasons = [...new Set(tournaments.map((t) => seasonOf(t.date)))].sort();
        return seasons.map((s) => {
            const y = Number(s.slice(0, 4));
            return { key: s, label: seasonLabel(s), from: `${y}-07-01`, to: `${y + 1}-06-30` };
        });
    }, [tournaments]);

    // "Class of 2027", "Class of 2028", … for everyone listed (plus anyone with no year set)
    const classGroups = (people: typeof debaters) => {
        const counts = new Map<number | null, number>();
        for (const d of people) {
            const y = classOf(d);
            counts.set(y, (counts.get(y) ?? 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => (a[0] ?? 9999) - (b[0] ?? 9999))
            .map(([year, count]) => ({
                key: classKey(year),
                label: year == null ? 'Class year not set' : `Class of ${year}`,
                count,
            }));
    };
    // a class with someone still on the team is current; one with only graduates is listed apart
    // (and needs a year to be picked out)
    const currentKeys = new Set(pool.map((d) => classKey(classOf(d))));
    const allClasses = classGroups(listed);
    const currentClasses = allClasses.filter((c) => currentKeys.has(c.key));
    const graduatedClasses = allClasses.filter(
        (c) => !currentKeys.has(c.key) && c.key !== classKey(null)
    );
    const classOptions = [...currentClasses, ...graduatedClasses];
    const defaultSelection = currentClasses[0]?.key ?? 'ALL';
    // a class or person that's no longer listed (e.g. back from All individuals) falls back to the default
    const listedPerson = (id: string) => listed.some((d) => d.id === id);
    const selectedId =
        !chosenId ||
        (isClassKey(chosenId) && !classOptions.some((c) => c.key === chosenId)) ||
        (view === 'people' && chosenId !== 'ALL' && !isClassKey(chosenId) && !listedPerson(chosenId))
            ? view === 'teams'
                ? ALL_TEAMS
                : defaultSelection
            : chosenId;
    const canCompare = (d: { id: string }) => d.id !== selectedId && !compareIds.includes(d.id);
    const teamPool = useMemo(
        () =>
            teams
                .filter((t) => chartIncludesTeam(t, who, byId))
                .map((t) => ({
                    key: teamKey(t.id),
                    name: teamName(t, byId),
                    elo: teamElo(t, byId),
                }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [teams, who, byId]
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
            isGroup,
            selectedId,
            compareIds,
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
                                switchView('people');
                                setAllPeople(false);
                                // people who aren't active drop off the comparison
                                setCompareIds((ids) => ids.filter((id) => activeIds.has(id)));
                            }}
                        >
                            Individuals
                        </button>
                        <button
                            type="button"
                            aria-pressed={view === 'people' && allPeople}
                            onClick={() => {
                                switchView('people');
                                setAllPeople(true);
                            }}
                        >
                            All individuals
                        </button>
                        <button
                            type="button"
                            aria-pressed={view === 'teams'}
                            onClick={() => switchView('teams')}
                        >
                            Teams<span className="wide-only"> (averaged)</span>
                        </button>
                    </div>
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
                                        {currentClasses.map((c) => (
                                            <option key={c.key} value={c.key}>
                                                {c.label} ({c.count})
                                            </option>
                                        ))}
                                    </optgroup>
                                    {graduatedClasses.length > 0 && (
                                        <optgroup label="Graduated classes">
                                            {graduatedClasses.map((c) => (
                                                <option key={c.key} value={c.key}>
                                                    {c.label} ({c.count})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="People">
                                        {pool.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name} ({Math.round(d.elo)})
                                            </option>
                                        ))}
                                    </optgroup>
                                    {graduates.length > 0 && (
                                        <optgroup label="Graduates">
                                            {graduates.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name} ({Math.round(d.elo)})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </>
                            ) : (
                                <>
                                    <option value={ALL_TEAMS}>
                                        All current teams
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
                            {view === 'people' ? (
                                <>
                                    {pool.filter(canCompare).map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                    {graduates.some(canCompare) && (
                                        <optgroup label="Graduates">
                                            {graduates.filter(canCompare).map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </>
                            ) : (
                                teamPool
                                    .filter((t) => t.key !== selectedId && !compareIds.includes(t.key))
                                    .map((t) => (
                                        <option key={t.key} value={t.key}>
                                            {t.name}
                                        </option>
                                    ))
                            )}
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
