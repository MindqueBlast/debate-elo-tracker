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
/** Everyone on the team plus every graduate (with the whole team listed). 'ALL' is just the team. */
export const ALL_CLASSES = 'ALL_CLASSES';
/** Every graduate (with the whole team listed). */
export const GRADUATED_CLASSES = 'GRADUATED_CLASSES';
export const teamKey = (id: string) => `team:${id}`;
/** Everyone graduating in a year ('class:2027'), or with no class year set ('class:none'). */
export const classKey = (year: number | null) => `class:${year ?? 'none'}`;
export const isClassKey = (id: string) => id.startsWith('class:');
/** A selection that draws a group of people rather than one person or team. */
export const isPeopleGroup = (id: string) =>
    id === 'ALL' || id === ALL_CLASSES || id === GRADUATED_CLASSES || isClassKey(id);
/** Someone's class: their class year, or for a graduate with none set, the year they graduated. */
export function classOf(d: Pick<Debater, 'class_year' | 'status' | 'graduation_date'>): number | null {
    if (d.class_year != null) return d.class_year;
    if (d.status === 'graduated' && d.graduation_date) {
        const y = Number(d.graduation_date.slice(0, 4));
        return Number.isFinite(y) ? y : null;
    }
    return null;
}

/**
 * Who a chart lists: people who competed this season, everyone still on the
 * team (inactive people included), or everyone ever, graduates too.
 */
export type ChartWho = 'active' | 'team' | 'all';

export function chartIncludes(
    d: Debater,
    who: ChartWho,
    activeIds?: ReadonlySet<string>
): boolean {
    if (who === 'all') return true;
    if (who === 'team') return d.status !== 'graduated';
    return activeIds ? activeIds.has(d.id) : d.status === 'active';
}

/** Teams that go with each choice: current ones, ones whose two people are both still on the team, or all. */
export function chartIncludesTeam(t: Team, who: ChartWho, byId: Map<string, Debater>): boolean {
    if (who === 'all' || t.active) return true;
    if (who === 'active') return false;
    return [t.member1_id, t.member2_id].every((id) => {
        const d = byId.get(id);
        return !!d && d.status !== 'graduated';
    });
}

export interface BuildEloSeriesOptions {
    debaters: Debater[];
    teams?: Team[];
    selectedId: string;
    compareId?: string | null;
    /** Any number of extra people or teams drawn next to the selected one. */
    compareIds?: string[];
    startDate?: string | null;
    endDate?: string | null;
    /** Show everyone (otherwise only active people and current teams). Same as who: 'all'. */
    showGraduated?: boolean;
    /** Who group views list (defaults to 'active', or 'all' with showGraduated). */
    who?: ChartWho;
    /** Who counts as active (competed this season); defaults to anyone not graduated. */
    activeIds?: ReadonlySet<string>;
    annotations?: Annotation[];
    showAnnotations?: boolean;
    /** With these, points are labelled with what happened (tournament name and change). */
    tournaments?: Tournament[];
    practiceRounds?: PracticeRound[];
    /** Team lines start with whichever partner came first, showing just them until both are on the team. */
    extendTeams?: boolean;
    /**
     * Classes to draw ('class:2027', …). With selectedId ALL_TEAMS, the teams with a member in
     * one of them; otherwise everyone listed in them, plus their graduates.
     */
    classes?: string[];
}

/** Whether a person is drawn in a class view: in one of the classes and listed for this choice. */
function inClassView(
    d: Debater,
    keys: ReadonlySet<string>,
    who: ChartWho,
    activeIds?: ReadonlySet<string>
): boolean {
    const year = classOf(d);
    if (!keys.has(classKey(year))) return false;
    // graduates count in their class whichever people are listed
    return chartIncludes(d, who, activeIds) || (d.status === 'graduated' && year != null);
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
    endDate?: string | null,
    extend = false
): ChartSeries {
    const byId = lookup(debaters);
    const members = pairingMembers([team.member1_id, team.member2_id], byId).map(
        (m) => ({ ...m, history: sanitizeHistory(m.history) })
    );
    const all = pairingHistory(members, extend);
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
    endDate?: string | null,
    extend = false
): ChartSeries | null {
    if (id.startsWith('team:')) {
        const team = teams.find((t) => teamKey(t.id) === id);
        return team ? teamSeries(team, debaters, index, startDate, endDate, extend) : null;
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
        who = showGraduated ? 'all' : 'active',
        activeIds,
        annotations = [],
        showAnnotations = false,
        tournaments,
        practiceRounds,
        extendTeams = false,
        classes,
    } = options;

    const index =
        tournaments || practiceRounds
            ? buildEventIndex(tournaments ?? [], practiceRounds ?? [], lookup(debaters))
            : null;
    const series: ChartSeries[] = [];

    if (classes) {
        const keys = new Set(classes);
        const byId = lookup(debaters);
        if (selectedId === ALL_TEAMS) {
            for (const team of teams) {
                if (!chartIncludesTeam(team, who, byId)) continue;
                const inClass = [team.member1_id, team.member2_id].some((id) => {
                    const d = byId.get(id);
                    return !!d && keys.has(classKey(classOf(d)));
                });
                if (inClass) series.push(teamSeries(team, debaters, index, startDate, endDate, extendTeams));
            }
        } else {
            for (const debater of debaters) {
                if (!inClassView(debater, keys, who, activeIds)) continue;
                series.push({
                    id: debater.id,
                    label: debater.name,
                    data: pointsFromHistory(debater, prepareHistory(debater, startDate, endDate), index),
                });
            }
        }
    } else if (isPeopleGroup(selectedId)) {
        const cls = isClassKey(selectedId) ? selectedId.slice('class:'.length) : null;
        // graduates are drawn only when the whole team is listed (or everyone is)
        const graduate = (d: Debater) => d.status === 'graduated' && who !== 'active';
        const pool = debaters.filter((d) => {
            if (selectedId === GRADUATED_CLASSES) return graduate(d);
            if (selectedId === ALL_CLASSES) return chartIncludes(d, who, activeIds) || graduate(d);
            if (cls === null) return chartIncludes(d, who, activeIds);
            const inClass = cls === 'none' ? classOf(d) == null : classOf(d) === Number(cls);
            // with the whole team listed, a class view is everyone in that class, graduates too
            const listed =
                chartIncludes(d, who, activeIds) ||
                (who === 'team' && d.status === 'graduated' && cls !== 'none');
            return inClass && listed;
        });
        for (const debater of pool) {
            const history = prepareHistory(debater, startDate, endDate);
            series.push({
                id: debater.id,
                label: debater.name,
                data: pointsFromHistory(debater, history, index),
            });
        }
    } else if (selectedId === ALL_TEAMS) {
        const byId = lookup(debaters);
        for (const team of teams.filter((t) => chartIncludesTeam(t, who, byId))) {
            series.push(teamSeries(team, debaters, index, startDate, endDate, extendTeams));
        }
    } else {
        const primary = seriesFor(selectedId, debaters, teams, index, startDate, endDate, extendTeams);
        if (primary) series.push(primary);
        const others = [...compareIds, ...(compareId ? [compareId] : [])];
        for (const id of new Set(others)) {
            if (id === selectedId) continue;
            const other = seriesFor(id, debaters, teams, index, startDate, endDate, extendTeams);
            if (other) series.push(other);
        }
    }

    const domain = yDomain(series);
    const hasPoints = series.some((s) => s.data.length > 0);

    if (showAnnotations && hasPoints && domain.min !== null) {
        // only dates within the lines shown, so a graduated class's chart ends when they did
        const xs = series.flatMap((s) => s.data.map((p) => p.x));
        const first = xs.reduce((a, b) => (b < a ? b : a));
        const last = xs.reduce((a, b) => (b > a ? b : a));
        const inRange = annotations.filter((a) => {
            if (startDate && a.date < startDate) return false;
            if (endDate && a.date > endDate) return false;
            return a.date >= first && a.date <= last;
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
