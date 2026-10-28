/**
 * Moving between what the database rows hold and the facts/results split the
 * Elo engine works with. No network code here, so scripts can use it too.
 */
import type {
    Debater,
    Derived,
    EloAdjustment,
    Inputs,
    PracticeRound,
    Tournament,
} from '../domain';

export interface Rows {
    debaters: Debater[];
    tournaments: Tournament[];
    practiceRounds: PracticeRound[];
    adjustments: EloAdjustment[];
}

/** The facts: who, when, and what happened. */
export function toInputs(rows: Rows): Inputs {
    return {
        people: rows.debaters.map((d) => ({
            id: d.id,
            name: d.name,
            division: d.division ?? null,
            status: d.status,
            graduation_date: d.graduation_date,
            class_year: d.class_year ?? null,
            start_elo: d.start_elo,
            start_date: d.start_date,
            created_at: d.created_at ?? null,
        })),
        tournaments: rows.tournaments.map((t) => ({
            id: t.id,
            date: t.date,
            name: t.name,
            bonus: t.bonus ?? null,
            affect: t.affect ?? null,
            max_gain: t.max_gain ?? null,
            max_rounds: t.max_rounds ?? null,
            created_at: t.created_at ?? null,
            entries: t.tournament_participants
                .filter((p): p is typeof p & { id: string } => !!p.id)
                .map((p) => ({
                    id: p.id,
                    debater_id: p.debater_id,
                    partner_id: p.partner_id ?? null,
                    team_id: p.team_id ?? null,
                    division: p.division,
                    raw_wins: p.raw_wins,
                    rounds: p.rounds ?? null,
                })),
        })),
        practice: rows.practiceRounds.map((r) => ({
            id: r.id,
            date: r.date,
            winner_id: r.winner_id,
            winner_partner_id: r.winner_partner_id ?? null,
            loser_id: r.loser_id,
            loser_partner_id: r.loser_partner_id ?? null,
            created_at: r.created_at ?? null,
        })),
        adjustments: rows.adjustments.map((a) => ({ ...a })),
    };
}

/** The numbers as they're currently stored (a copy of an earlier calculation). */
export function storedResults(rows: Rows): Derived {
    const out: Derived = { people: {}, entries: {}, tournaments: {}, practice: {} };
    for (const d of rows.debaters) out.people[d.id] = { elo: d.elo, history: d.history };
    for (const t of rows.tournaments) {
        out.tournaments[t.id] = { e_tourney: t.e_tourney };
        for (const p of t.tournament_participants) {
            if (!p.id) continue;
            out.entries[p.id] = {
                elo_change: p.elo_change,
                partner_elo_change: p.partner_elo_change ?? null,
                adjusted_wins: p.adjusted_wins,
                team_elo: p.team_elo ?? 0,
            };
        }
    }
    for (const r of rows.practiceRounds) {
        out.practice[r.id] = {
            winner_change: r.winner_change,
            loser_change: r.loser_change,
            winner_partner_change: r.winner_partner_change ?? null,
            loser_partner_change: r.loser_partner_change ?? null,
        };
    }
    return out;
}

/** Rows showing freshly calculated numbers instead of the stored ones. */
export function withResults(rows: Rows, d: Derived): Rows {
    return {
        ...rows,
        debaters: rows.debaters.map((x) => {
            const r = d.people[x.id];
            return r ? { ...x, elo: r.elo, history: r.history } : x;
        }),
        tournaments: rows.tournaments.map((t) => ({
            ...t,
            e_tourney: d.tournaments[t.id]?.e_tourney ?? t.e_tourney,
            tournament_participants: t.tournament_participants.map((p) => {
                const r = p.id ? d.entries[p.id] : undefined;
                return r ? { ...p, ...r } : p;
            }),
        })),
        practiceRounds: rows.practiceRounds.map((r) => {
            const x = d.practice[r.id];
            return x ? { ...r, ...x } : r;
        }),
    };
}
