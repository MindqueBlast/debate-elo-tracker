import { supabase } from './supabase';
import { sanitizeDebaters } from '../domain';
import type {
    Annotation,
    Debater,
    PracticeRound,
    Tournament,
} from '../domain';

export interface AppSnapshot {
    debaters: Debater[];
    practiceRounds: PracticeRound[];
    tournaments: Tournament[];
    annotations: Annotation[];
}

function asPracticeRounds(raw: unknown): PracticeRound[] {
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
            winner_change,
            loser_change,
        });
    }
    return rounds;
}

function asTournaments(raw: unknown): Tournament[] {
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
            tournament_participants: participantsRaw
                .filter((p) => p && typeof p === 'object')
                .map((p) => {
                    const rec = p as Record<string, unknown>;
                    const division =
                        rec.division === 'JV' || rec.division === 'Varsity'
                            ? rec.division
                            : 'Novice';
                    return {
                        tournament_id: String(rec.tournament_id ?? t.id),
                        debater_id: String(rec.debater_id ?? ''),
                        raw_wins: Number(rec.raw_wins) || 0,
                        adjusted_wins: Number(rec.adjusted_wins) || 0,
                        elo_change: Number(rec.elo_change) || 0,
                        division,
                        debaters:
                            rec.debaters && typeof rec.debaters === 'object'
                                ? {
                                      name: String(
                                          (rec.debaters as { name?: unknown })
                                              .name ?? ''
                                      ),
                                  }
                                : null,
                    };
                }),
        });
    }
    return tournaments;
}

function asAnnotations(raw: unknown): Annotation[] {
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

export async function loadSnapshot(): Promise<AppSnapshot> {
    const [debatersRes, annotationsRes, roundsRes, tournamentsRes] =
        await Promise.all([
            supabase.from('debaters').select('*'),
            supabase.from('annotations').select('*'),
            supabase.from('practice_rounds').select('*'),
            supabase
                .from('tournaments')
                .select('*, tournament_participants(*, debaters(name))'),
        ]);

    if (debatersRes.error) throw debatersRes.error;
    if (annotationsRes.error) throw annotationsRes.error;

    return {
        debaters: sanitizeDebaters(debatersRes.data),
        annotations: asAnnotations(annotationsRes.data),
        practiceRounds: asPracticeRounds(roundsRes.data ?? []),
        tournaments: asTournaments(tournamentsRes.data ?? []),
    };
}
