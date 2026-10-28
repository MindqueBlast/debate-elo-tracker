import {
    entryChangeFor,
    pairingLabel,
    practiceChangeFor,
    practiceSide,
    type DebaterLookup,
} from './teams';
import type { PracticeRound, Tournament } from './types';

/** Labels chart points with what actually happened that day. */
export interface EventIndex {
    tournamentsByDate: Map<string, Tournament[]>;
    practiceByDate: Map<string, PracticeRound[]>;
    byId: DebaterLookup;
}

export function buildEventIndex(
    tournaments: Tournament[],
    practiceRounds: PracticeRound[],
    byId: DebaterLookup
): EventIndex {
    const tournamentsByDate = new Map<string, Tournament[]>();
    for (const t of tournaments) {
        const list = tournamentsByDate.get(t.date) ?? [];
        list.push(t);
        tournamentsByDate.set(t.date, list);
    }
    const practiceByDate = new Map<string, PracticeRound[]>();
    for (const r of practiceRounds) {
        const list = practiceByDate.get(r.date) ?? [];
        list.push(r);
        practiceByDate.set(r.date, list);
    }
    return { tournamentsByDate, practiceByDate, byId };
}

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;

/**
 * What happened to these people (one person, or a pair) on a date.
 * - kind 'tournament': the tournament(s) they were in, or the one they missed
 * - kind 'plain': a practice round that day, or their starting Elo
 * - kind 'any': whichever applies
 */
export function describeDay(
    ids: string[],
    date: string,
    index: EventIndex,
    kind: 'tournament' | 'plain' | 'any',
    isStart = false
): string | undefined {
    const nameOf = (id: string) => index.byId.get(id)?.name ?? 'Unknown';
    const parts: string[] = [];
    const missed: string[] = [];

    if (kind !== 'plain') {
        for (const t of index.tournamentsByDate.get(date) ?? []) {
            const name = t.name || 'Tournament';
            const mine = ids.flatMap((id) => {
                const entry = t.tournament_participants.find(
                    (p) => p.debater_id === id || p.partner_id === id
                );
                return entry ? [{ id, change: entryChangeFor(entry, id) }] : [];
            });
            if (mine.length === 0) {
                missed.push(name);
            } else if (ids.length === 1) {
                parts.push(`${name} ${signed(mine[0].change)}`);
            } else {
                parts.push(
                    `${name}: ${mine.map((m) => `${nameOf(m.id)} ${signed(m.change)}`).join(', ')}`
                );
            }
        }
    }

    if (kind !== 'tournament') {
        for (const r of index.practiceByDate.get(date) ?? []) {
            const involved = ids.filter((id) => practiceSide(r, id) !== null);
            if (involved.length === 0) continue;
            const won = practiceSide(r, involved[0]) === 'won';
            const opponents = won
                ? [r.loser_id, r.loser_partner_id]
                : [r.winner_id, r.winner_partner_id];
            const changes =
                ids.length === 1
                    ? signed(practiceChangeFor(r, involved[0]))
                    : involved.map((id) => `${nameOf(id)} ${signed(practiceChangeFor(r, id))}`).join(', ');
            parts.push(
                `Practice ${won ? 'win' : 'loss'} vs ${pairingLabel(opponents, index.byId)} ${changes}`
            );
        }
    }

    if (parts.length > 0) return parts.join(' · ');
    if (missed.length > 0) return `Didn't attend ${missed.join(', ')}`;
    if (isStart) return 'Starting Elo';
    return undefined;
}
