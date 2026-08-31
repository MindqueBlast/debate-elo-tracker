import { useMemo, useRef, useState } from 'react';
import { buildEloSeries, isCalendarDate, snapshotFromSeries } from '../domain';
import {
    addAnnotation,
    deleteHistoryPoint,
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
    const { debaters, annotations, refresh } = useAppData();
    const toast = useToast();
    const wrapRef = useRef<HTMLDivElement>(null);
    const [selectedId, setSelectedId] = useState('ALL');
    const [compareId, setCompareId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showAnnotations, setShowAnnotations] = useState(true);
    const [showGraduated, setShowGraduated] = useState(false);
    const [eventDate, setEventDate] = useState('');
    const [eventName, setEventName] = useState('');
    const [uploaded, setUploaded] = useState<ChartSeries[] | null>(null);

    const pool = showGraduated
        ? debaters
        : debaters.filter((d) => d.status === 'active');

    const result = useMemo(
        () =>
            buildEloSeries({
                debaters,
                selectedId,
                compareId: selectedId === 'ALL' ? null : compareId,
                startDate: startDate || null,
                endDate: endDate || null,
                showGraduated,
                annotations,
                showAnnotations,
            }),
        [
            debaters,
            selectedId,
            compareId,
            startDate,
            endDate,
            showGraduated,
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
                    <div className="chart-toolbar">
                        <div className="field">
                            <label htmlFor="analyticsDebater">Debater</label>
                            <select
                                id="analyticsDebater"
                                value={selectedId}
                                onChange={(e) => {
                                    setSelectedId(e.target.value);
                                    if (e.target.value === 'ALL') setCompareId('');
                                }}
                            >
                                <option value="ALL">All debaters</option>
                                {pool.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name} ({Math.round(d.elo)})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label htmlFor="compareDebater">Compare with</label>
                            <select
                                id="compareDebater"
                                value={compareId}
                                disabled={selectedId === 'ALL'}
                                onChange={(e) => setCompareId(e.target.value)}
                            >
                                <option value="">None</option>
                                {pool
                                    .filter((d) => d.id !== selectedId)
                                    .map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
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
                            checked={showGraduated}
                            onChange={(e) => setShowGraduated(e.target.checked)}
                        />
                        Include graduated
                    </label>
                    <div ref={wrapRef}>
                        <EloChart
                            series={result.series}
                            yMin={result.yMin}
                            yMax={result.yMax}
                            isEmpty={result.isEmpty}
                            framed
                            onPointClick={
                                isAdmin
                                    ? async (debaterId, date) => {
                                          const debater = debaters.find(
                                              (d) => d.id === debaterId
                                          );
                                          if (!debater) return;
                                          if (
                                              !confirm(
                                                  `Delete Elo point for ${debater.name} on ${date}?`
                                              )
                                          )
                                              return;
                                          await deleteHistoryPoint(debater, date);
                                          toast.push('History point removed.', 'success');
                                          await refresh();
                                      }
                                    : undefined
                            }
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
                                a.download =
                                    selectedId === 'ALL'
                                        ? 'all_debaters_elo_graph.png'
                                        : `${debaters.find((d) => d.id === selectedId)?.name ?? 'elo'}_graph.png`;
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
                                .sort((a, b) => a.date.localeCompare(b.date))
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
