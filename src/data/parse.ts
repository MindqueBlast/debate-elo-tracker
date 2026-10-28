/** Turning raw database rows into typed records, skipping anything malformed. */
import type {
    Annotation,
    Division,
    EloAdjustment,
    PracticeRound,
    Team,
    Tournament,
} from '../domain';

const optionalId = (v: unknown): string | null =>
    typeof v === 'string' && v ? v : null;

const optionalNumber = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const asDivision = (v: unknown): Division | null =>
    v === 'Novice' || v === 'JV' || v === 'Varsity' ? v : null;

export function asPracticeRounds(raw: unknown): PracticeRound[] {
    if (!Array.isArray(raw)) return [];
    const rounds: PracticeRound[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        if (typeof r.id !== 'string') continue;
        const winner_change = Number(r.winner_change);
        const loser_change = Number(r.loser_change);
        if (!Number.isFinite(winner_change) || !Number.isFinite(loser_change)) {
            continue;
        }
        rounds.push({
            id: r.id,
            date: String(r.date ?? '').slice(0, 10),
            winner_id: String(r.winner_id ?? ''),
            loser_id: String(r.loser_id ?? ''),
            winner_partner_id: optionalId(r.winner_partner_id),
            loser_partner_id: optionalId(r.loser_partner_id),
            winner_change,
            loser_change,
            winner_partner_change: optionalNumber(r.winner_partner_change),
            loser_partner_change: optionalNumber(r.loser_partner_change),
            created_at: typeof r.created_at === 'string' ? r.created_at : null,
        });
    }
    return rounds;
}

export function asTournaments(raw: unknown): Tournament[] {
    if (!Array.isArray(raw)) return [];
    const tournaments: Tournament[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const t = item as Record<string, unknown>;
        if (typeof t.id !== 'string') continue;
        const participantsRaw = Array.isArray(t.tournament_participants)
            ? t.tournament_participants
            : [];
        tournaments.push({
            id: t.id,
            date: String(t.date ?? '').slice(0, 10),
            name: typeof t.name === 'string' ? t.name : null,
            e_tourney: Number(t.e_tourney) || 0,
            bonus: optionalNumber(t.bonus),
            affect: optionalNumber(t.affect),
            max_gain: optionalNumber(t.max_gain),
            max_rounds: optionalNumber(t.max_rounds),
            created_at: typeof t.created_at === 'string' ? t.created_at : null,
            tournament_participants: participantsRaw
                .filter((p) => p && typeof p === 'object')
                .map((p) => {
                    const rec = p as Record<string, unknown>;
                    return {
                        id: optionalId(rec.id) ?? undefined,
                        tournament_id: String(rec.tournament_id ?? t.id),
                        debater_id: String(rec.debater_id ?? ''),
                        partner_id: optionalId(rec.partner_id),
                        team_id: optionalId(rec.team_id),
                        raw_wins: Number(rec.raw_wins) || 0,
                        adjusted_wins: Number(rec.adjusted_wins) || 0,
                        elo_change: Number(rec.elo_change) || 0,
                        partner_elo_change: optionalNumber(rec.partner_elo_change),
                        division: asDivision(rec.division) ?? 'Novice',
                        team_elo: optionalNumber(rec.team_elo),
                        rounds: optionalNumber(rec.rounds),
                    };
                }),
        });
    }
    return tournaments;
}

export function asTeams(raw: unknown): Team[] {
    if (!Array.isArray(raw)) return [];
    const teams: Team[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const t = item as Record<string, unknown>;
        const member1 = optionalId(t.member1_id);
        const member2 = optionalId(t.member2_id);
        if (typeof t.id !== 'string' || !member1 || !member2) continue;
        teams.push({
            id: t.id,
            name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : null,
            member1_id: member1,
            member2_id: member2,
            division: asDivision(t.division),
            season: typeof t.season === 'string' ? t.season : null,
            active: t.active !== false,
        });
    }
    return teams;
}

export function asAnnotations(raw: unknown): Annotation[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((a) => a && typeof a === 'object')
        .map((a) => {
            const rec = a as Record<string, unknown>;
            return {
                id: String(rec.id ?? ''),
                date: String(rec.date ?? '').slice(0, 10),
                name: String(rec.name ?? ''),
            };
        })
        .filter((a) => a.id && a.date && a.name);
}


export function asAdjustments(raw: unknown): EloAdjustment[] {
    if (!Array.isArray(raw)) return [];
    const out: EloAdjustment[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        const amount = Number(r.amount);
        if (typeof r.id !== 'string' || typeof r.debater_id !== 'string' || !Number.isFinite(amount)) {
            continue;
        }
        out.push({
            id: r.id,
            debater_id: r.debater_id,
            date: String(r.date ?? '').slice(0, 10),
            amount,
            note: typeof r.note === 'string' && r.note ? r.note : null,
            created_at: typeof r.created_at === 'string' ? r.created_at : null,
        });
    }
    return out;
}
