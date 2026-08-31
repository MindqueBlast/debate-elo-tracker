import {
    filterHistoryByGraduation,
    filterHistoryByRange,
    sanitizeHistory,
} from './history';
import type {
    Annotation,
    ChartPoint,
    ChartSeries,
    Debater,
    EloSeriesResult,
    HistoryPoint,
} from './types';

export interface BuildEloSeriesOptions {
    debaters: Debater[];
    selectedId: string;
    compareId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    showGraduated?: boolean;
    annotations?: Annotation[];
    showAnnotations?: boolean;
}

function pointsFromHistory(history: HistoryPoint[]): ChartPoint[] {
    return history.map((h) => ({
        x: h.date,
        y: h.elo,
        event: h.event,
    }));
}

function prepareHistory(
    debater: Debater,
    startDate?: string | null,
    endDate?: string | null
): HistoryPoint[] {
    let history = sanitizeHistory(debater.history);
    if (debater.status === 'graduated') {
        history = filterHistoryByGraduation(history, debater.graduation_date);
    }
    return filterHistoryByRange(history, startDate, endDate);
}

function yDomain(series: ChartSeries[]): { min: number | null; max: number | null } {
    const values: number[] = [];
    for (const s of series) {
        for (const p of s.data) values.push(p.y);
    }
    if (values.length === 0) return { min: null, max: null };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(12, (max - min) * 0.08 || 24);
    return { min: min - pad, max: max + pad };
}

export function buildEloSeries(options: BuildEloSeriesOptions): EloSeriesResult {
    const {
        debaters,
        selectedId,
        compareId,
        startDate,
        endDate,
        showGraduated = false,
        annotations = [],
        showAnnotations = false,
    } = options;

    const series: ChartSeries[] = [];

    if (selectedId === 'ALL') {
        const pool = debaters.filter(
            (d) => showGraduated || d.status === 'active'
        );
        for (const debater of pool) {
            const history = prepareHistory(debater, startDate, endDate);
            series.push({
                id: debater.id,
                label: debater.name,
                data: pointsFromHistory(history),
            });
        }
    } else {
        const primary = debaters.find((d) => d.id === selectedId);
        if (primary) {
            series.push({
                id: primary.id,
                label: primary.name,
                data: pointsFromHistory(
                    prepareHistory(primary, startDate, endDate)
                ),
            });
        }
        if (compareId && compareId !== selectedId) {
            const other = debaters.find((d) => d.id === compareId);
            if (other) {
                series.push({
                    id: other.id,
                    label: other.name,
                    data: pointsFromHistory(
                        prepareHistory(other, startDate, endDate)
                    ),
                });
            }
        }
    }

    const domain = yDomain(series);
    const hasPoints = series.some((s) => s.data.length > 0);

    if (showAnnotations && hasPoints && domain.min !== null) {
        const inRange = annotations.filter((a) => {
            if (startDate && a.date < startDate) return false;
            if (endDate && a.date > endDate) return false;
            return true;
        });
        series.push({
            id: '__annotations__',
            label: 'Important Dates',
            data: inRange.map((a) => ({
                x: a.date,
                y: domain.min as number,
                event: a.name,
            })),
        });
    }

    return {
        series,
        yMin: domain.min,
        yMax: domain.max,
        isEmpty: !hasPoints,
    };
}

export function snapshotFromSeries(series: ChartSeries[]) {
    return series
        .filter((s) => s.id !== '__annotations__')
        .map((s) => ({
            id: s.id,
            name: s.label,
            history: s.data.map((p) => ({
                date: p.x,
                elo: p.y,
                event: p.event,
            })),
        }));
}
