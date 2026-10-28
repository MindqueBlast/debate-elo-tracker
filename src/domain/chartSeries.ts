import { buildEventIndex, competedOn, describeDay, type EventIndex } from './describe';
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
    PracticeRound,
    Team,
    Tournament,
} from './types';

/** Chart selection ids: a debater id, 'ALL', 'ALL_TEAMS' or 'team:<id>'. */
export const ALL_TEAMS = 'ALL_TEAMS';
export const teamKey = (id: string) => `team:${id}`;

export interface BuildEloSeriesOptions {
    debaters: Debater[];
    teams?: Team[];
    selectedId: string;
    compareId?: string | null;
    /** Any number of extra people or teams drawn next to the selected one. */
    compareIds?: string[];
    startDate?: string | null;
    endDate?: string | null;
    showGraduated?: boolean;
    annotations?: Annotation[];
    showAnnotations?: boolean;
    /** With these, points are labelled with what happened (tournament name and change). */
    tournaments?: Tournament[];
    practiceRounds?: PracticeRound[];
}

function pointsFromHistory(
    debater: Debater,
    history: HistoryPoint[],
    index: EventIndex | null
): ChartPoint[] {
    const firstDate = sanitizeHistory(debater.history)[0]?.date;
    return history.map((h) => {
        let event = h.event;
        if (index) {
            if (h.event === 'Tournament') {
                event = describeDay([debater.id], h.date, index, 'tournament') ?? h.event;
            } else if (!h.event) {
                event = describeDay([debater.id], h.date, index, 'plain', h.date === firstDate);
            }
        }
        return {
            x: h.date,
            y: h.elo,
            event,
            competed: index ? competedOn([debater.id], h.date, index) : undefined,
        };
    });
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
    index: EventIndex | null,
    startDate?: string | null,
    endDate?: string | null
): ChartSeries {
    const byId = lookup(debaters);
    const members = pairingMembers([team.member1_id, team.member2_id], byId).map(
        (m) => ({ ...m, history: sanitizeHistory(m.history) })
    );
    const all = pairingHistory(members);
    const firstDate = all[0]?.x;
    const data = all
        .filter((p) => (!startDate || p.x >= startDate) && (!endDate || p.x <= endDate))
        .map((p) => ({
            ...p,
            event: index
                ? describeDay(members.map((m) => m.id), p.x, index, 'any', p.x === firstDate) ?? p.event
                : p.event,
            competed: index ? competedOn(members.map((m) => m.id), p.x, index) : undefined,
        }));
    return { id: teamKey(team.id), label: teamName(team, byId), data };
}

function seriesFor(
    id: string,
    debaters: Debater[],
    teams: Team[],
    index: EventIndex | null,
    startDate?: string | null,
    endDate?: string | null
): ChartSeries | null {
    if (id.startsWith('team:')) {
        const team = teams.find((t) => teamKey(t.id) === id);
        return team ? teamSeries(team, debaters, index, startDate, endDate) : null;
    }
    const debater = debaters.find((d) => d.id === id);
    if (!debater) return null;
    return {
        id: debater.id,
        label: debater.name,
        data: pointsFromHistory(debater, prepareHistory(debater, startDate, endDate), index),
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
        compareIds = [],
        startDate,
        endDate,
        showGraduated = false,
        annotations = [],
        showAnnotations = false,
        tournaments,
        practiceRounds,
    } = options;

    const index =
        tournaments || practiceRounds
            ? buildEventIndex(tournaments ?? [], practiceRounds ?? [], lookup(debaters))
            : null;
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
                data: pointsFromHistory(debater, history, index),
            });
        }
    } else if (selectedId === ALL_TEAMS) {
        for (const team of teams.filter((t) => t.active || showGraduated)) {
            series.push(teamSeries(team, debaters, index, startDate, endDate));
        }
    } else {
        const primary = seriesFor(selectedId, debaters, teams, index, startDate, endDate);
        if (primary) series.push(primary);
        const others = [...compareIds, ...(compareId ? [compareId] : [])];
        for (const id of new Set(others)) {
            if (id === selectedId) continue;
            const other = seriesFor(id, debaters, teams, index, startDate, endDate);
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
