import { pairingElo } from './elo';
import type {
    ChartPoint,
    Debater,
    HistoryPoint,
    PracticeRound,
    RankedTeam,
    Team,
} from './types';

export type DebaterLookup = Map<string, Debater>;

export function lookup(debaters: Debater[]): DebaterLookup {
    return new Map(debaters.map((d) => [d.id, d]));
}

/** Members of a pairing that exist on the roster, in order. */
export function pairingMembers(
    ids: (string | null | undefined)[],
    byId: DebaterLookup
): Debater[] {
    const out: Debater[] = [];
    for (const id of ids) {
        if (!id) continue;
        const d = byId.get(id);
        if (d) out.push(d);
    }
    return out;
}

export function pairingEloOf(
    ids: (string | null | undefined)[],
    byId: DebaterLookup
): number {
    return pairingElo(pairingMembers(ids, byId).map((d) => d.elo));
}

/** "Jiayi + Leon", or "Oscar + ?" when the partner isn't on record. */
export function pairingLabel(
    ids: (string | null | undefined)[],
    byId: DebaterLookup
): string {
    const names = ids
        .filter((id): id is string => !!id)
        .map((id) => byId.get(id)?.name ?? 'Unknown');
    if (names.length === 0) return 'Unknown';
    if (names.length === 1) return `${names[0]} + ?`;
    return names.join(' + ');
}

export function teamName(team: Team, byId: DebaterLookup): string {
    if (team.name && team.name.trim()) return team.name.trim();
    return pairingLabel([team.member1_id, team.member2_id], byId);
}

export function teamElo(team: Team, byId: DebaterLookup): number {
    return pairingEloOf([team.member1_id, team.member2_id], byId);
}

export function sameMembers(
    a: (string | null | undefined)[],
    b: (string | null | undefined)[]
): boolean {
    const norm = (ids: (string | null | undefined)[]) =>
        ids.filter((id): id is string => !!id).sort().join('|');
    return norm(a) === norm(b);
}

/** The saved team (if any) made of exactly these two people. */
export function findTeam(
    teams: Team[],
    ids: (string | null | undefined)[],
    preferActive = true
): Team | undefined {
    const matches = teams.filter((t) =>
        sameMembers([t.member1_id, t.member2_id], ids)
    );
    if (preferActive) {
        const active = matches.find((t) => t.active);
        if (active) return active;
    }
    return matches[matches.length - 1];
}

export function rankTeams(
    teams: Team[],
    debaters: Debater[],
    options: { showInactive?: boolean; search?: string } = {}
): RankedTeam[] {
    const { showInactive = false, search = '' } = options;
    const byId = lookup(debaters);
    const q = search.trim().toLowerCase();
    const rows = teams
        .filter((t) => showInactive || t.active)
        .map((team) => {
            const members = pairingMembers([team.member1_id, team.member2_id], byId);
            return {
                team,
                name: teamName(team, byId),
                members,
                elo: pairingElo(members.map((m) => m.elo)),
                rank: 0,
            };
        })
        .filter(
            (r) =>
                !q ||
                r.name.toLowerCase().includes(q) ||
                r.members.some((m) => m.name.toLowerCase().includes(q))
        )
        .sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name));
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
}

/** Which side of a practice round a person was on, if any. */
export function practiceSide(
    round: PracticeRound,
    debaterId: string
): 'won' | 'lost' | null {
    if (round.winner_id === debaterId || round.winner_partner_id === debaterId) {
        return 'won';
    }
    if (round.loser_id === debaterId || round.loser_partner_id === debaterId) {
        return 'lost';
    }
    return null;
}

/**
 * Team Elo over time: at every date either partner has a point, the average
 * of each partner's latest Elo up to that date.
 */
export function pairingHistory(members: Debater[]): ChartPoint[] {
    if (members.length === 0) return [];
    const histories = members.map((m) =>
        [...m.history].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    );
    const dates = Array.from(
        new Set(histories.flatMap((h) => h.map((p) => p.date)))
    ).sort();
    const points: ChartPoint[] = [];
    for (const date of dates) {
        const latest: number[] = [];
        let event: string | undefined;
        for (const h of histories) {
            const upTo = h.filter((p) => p.date <= date);
            if (upTo.length === 0) continue;
            const last: HistoryPoint = upTo[upTo.length - 1];
            latest.push(last.elo);
            if (last.date === date && last.event) event = last.event;
        }
        // Only plot once both partners have started (or the only partner has)
        if (latest.length < histories.length) continue;
        points.push({ x: date, y: pairingElo(latest), event });
    }
    return points;
}
