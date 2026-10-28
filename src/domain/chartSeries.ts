import {
    filterHistoryByGraduation,
    filterHistoryByRange,
    sanitizeHistory,
} from './history';
import { lookup, pairingHistory, pairingMembers, teamName } from './teams';
import type {
    Annotation,
    ChartPoint,
    ChartSeries,
    Debater,
    EloSeriesResult,
    HistoryPoint,
    Team,
} from './types';

/** Chart selection ids: a debater id, 'ALL', 'ALL_TEAMS' or 'team:<id>'. */
export const ALL_TEAMS = 'ALL_TEAMS';
export const teamKey = (id: string) => `team:${id}`;

export interface BuildEloSeriesOptions {
    debaters: Debater[];
    teams?: Team[];
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

function teamSeries(
    team: Team,
    debaters: Debater[],
    startDate?: string | null,
    endDate?: string | null
): ChartSeries {
    const byId = lookup(debaters);
    const members = pairingMembers([team.member1_id, team.member2_id], byId).map(
        (m) => ({ ...m, history: sanitizeHistory(m.history) })
    );
    const data = pairingHistory(members).filter(
        (p) => (!startDate || p.x >= startDate) && (!endDate || p.x <= endDate)
    );
    return { id: teamKey(team.id), label: teamName(team, byId), data };
}

function seriesFor(
    id: string,
    debaters: Debater[],
    teams: Team[],
    startDate?: string | null,
    endDate?: string | null
): ChartSeries | null {
    if (id.startsWith('team:')) {
        const team = teams.find((t) => teamKey(t.id) === id);
        return team ? teamSeries(team, debaters, startDate, endDate) : null;
    }
    const debater = debaters.find((d) => d.id === id);
    if (!debater) return null;
    return {
        id: debater.id,
        label: debater.name,
        data: pointsFromHistory(prepareHistory(debater, startDate, endDate)),
    };
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
    return { min: Math.floor((min - pad) / 10) * 10, max: Math.ceil((max + pad) / 10) * 10 };
}

export function buildEloSeries(options: BuildEloSeriesOptions): EloSeriesResult {
    const {
        debaters,
        teams = [],
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
    } else if (selectedId === ALL_TEAMS) {
        for (const team of teams.filter((t) => t.active)) {
            series.push(teamSeries(team, debaters, startDate, endDate));
        }
    } else {
        const primary = seriesFor(selectedId, debaters, teams, startDate, endDate);
        if (primary) series.push(primary);
        if (compareId && compareId !== selectedId) {
            const other = seriesFor(compareId, debaters, teams, startDate, endDate);
            if (other) series.push(other);
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
