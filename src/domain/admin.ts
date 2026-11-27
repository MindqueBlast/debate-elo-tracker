/**
 * The admin tools' planning, kept free of network code so it can be tested:
 * what new scoring settings rewrite, who graduates or moves up at the end of
 * a year, merging a person entered twice, and checks for likely mistakes.
 */
import { TOURNAMENT_TYPES, type EloConfig } from './config';
import type { Changes, State, TournamentRow } from './changes';
import type { InputPerson, Inputs } from './rebuild';
import { seasonOf } from './replay';
import type { Division, Team } from './types';

// ------------------------------------------------------------------ scoring

/** The division someone debated in first (their current one if they have no results). */
export function firstDivision(inputs: Inputs, id: string): Division | null {
    let best: { date: string; division: Division } | null = null;
    for (const t of inputs.tournaments) {
        for (const e of t.entries) {
            if (e.debater_id !== id && e.partner_id !== id) continue;
            if (!best || t.date < best.date) best = { date: t.date, division: e.division };
        }
    }
    return best?.division ?? inputs.people.find((p) => p.id === id)?.division ?? null;
}

export interface ScoringRewrite {
    /** Tournaments whose K or bonus followed the old settings. */
    tournaments: TournamentRow[];
    /** People whose starting Elo followed the old settings. */
    people: InputPerson[];
    inputs: Inputs;
}

/**
 * New settings rewrite the records that followed the old ones: tournaments at
 * the old K or an old type's bonus, and people who started at their first
 * division's old starting Elo. Anything set by hand to something else stays.
 */
export function scoringRewrite(inputs: Inputs, from: EloConfig, to: EloConfig): ScoringRewrite {
    const bonusMap = new Map<number, number>();
    for (const t of TOURNAMENT_TYPES) bonusMap.set(from.bonuses[t.id], to.bonuses[t.id]);

    const tournaments: TournamentRow[] = [];
    const nextTournaments = inputs.tournaments.map((t) => {
        const affect = t.affect === from.k ? to.k : t.affect;
        const bonus = t.bonus != null && bonusMap.has(t.bonus) ? bonusMap.get(t.bonus)! : t.bonus;
        if (affect === t.affect && bonus === t.bonus) return t;
        const next = { ...t, affect, bonus };
        const { entries: _e, ...row } = next;
        tournaments.push(row);
        return next;
    });

    const people: InputPerson[] = [];
    const nextPeople = inputs.people.map((p) => {
        const div = firstDivision(inputs, p.id);
        if (!div || p.start_elo !== from.startElo[div] || from.startElo[div] === to.startElo[div]) return p;
        const next = { ...p, start_elo: to.startElo[div] };
        people.push(next);
        return next;
    });

    return { tournaments, people, inputs: { ...inputs, tournaments: nextTournaments, people: nextPeople } };
}

// --------------------------------------------------------------- new season

const UP: Record<Division, Division | null> = { Novice: 'JV', JV: 'Varsity', Varsity: null };

/** The class that graduates at the end of the season `today` is in (2026-27 → 2027). */
export function graduatingYear(today: string): number {
    return Number(seasonOf(today).slice(0, 4)) + 1;
}

export interface SeasonPlan {
    graduating: InputPerson[];
    movingUp: { person: InputPerson; to: Division }[];
}

/** Who'd graduate (that class year, still active) and who'd move up a division. */
export function planNewSeason(inputs: Inputs, classYear: number): SeasonPlan {
    const active = inputs.people.filter((p) => p.status === 'active');
    const graduating = active.filter((p) => p.class_year != null && p.class_year <= classYear);
    const leaving = new Set(graduating.map((p) => p.id));
    const movingUp = active
        .filter((p) => !leaving.has(p.id) && p.division && UP[p.division])
        .map((p) => ({ person: p, to: UP[p.division as Division] as Division }));
    const byName = (a: InputPerson, b: InputPerson) => a.name.localeCompare(b.name);
    return {
        graduating: graduating.sort(byName),
        movingUp: movingUp.sort((a, b) => byName(a.person, b.person)),
    };
}

/**
 * Graduate and move up the people picked. Graduates are dated the end of
 * June of their class year (so the season they finish is their last), and
 * their saved teams come off the active list.
 */
export function newSeasonChanges(
    state: State,
    classYear: number,
    picks: { graduate: string[]; moveUp: string[] }
): Changes {
    const plan = planNewSeason(state.inputs, classYear);
    const graduate = new Set(picks.graduate);
    const moveUp = new Set(picks.moveUp);
    const people: InputPerson[] = [];
    for (const p of plan.graduating) {
        if (!graduate.has(p.id)) continue;
        people.push({ ...p, status: 'graduated', graduation_date: `${p.class_year ?? classYear}-06-30` });
    }
    for (const { person, to } of plan.movingUp) {
        if (moveUp.has(person.id)) people.push({ ...person, division: to });
    }
    const teams: Team[] = state.teams
        .filter((t) => t.active && (graduate.has(t.member1_id) || graduate.has(t.member2_id)))
        .map((t) => ({ ...t, active: false }));
    return { people_upsert: people, teams_upsert: teams };
}

// -------------------------------------------------------------------- merge

/**
 * Fold a person entered twice into the one to keep: every result, round,
 * adjustment and saved team moves over, then the extra is removed. The kept
 * person's start is the earlier of the two.
 */
export function mergeChanges(state: State, keepId: string, dropId: string): Changes {
    const keep = state.inputs.people.find((p) => p.id === keepId);
    const drop = state.inputs.people.find((p) => p.id === dropId);
    if (!keep || !drop || keepId === dropId) return {};
    const swap = (id: string | null) => (id === dropId ? keepId : id);

    const entries = state.inputs.tournaments.flatMap((t) =>
        t.entries
            .filter((e) => e.debater_id === dropId || e.partner_id === dropId)
            .map((e) => {
                const debater_id = swap(e.debater_id) as string;
                const partner = swap(e.partner_id);
                return { ...e, tournament_id: t.id, debater_id, partner_id: partner === debater_id ? null : partner };
            })
    );
    const practice = state.inputs.practice
        .filter((r) => [r.winner_id, r.winner_partner_id, r.loser_id, r.loser_partner_id].includes(dropId))
        .map((r) => ({
            ...r,
            winner_id: swap(r.winner_id) as string,
            winner_partner_id: swap(r.winner_partner_id),
            loser_id: swap(r.loser_id) as string,
            loser_partner_id: swap(r.loser_partner_id),
        }));
    const adjustments = state.inputs.adjustments
        .filter((a) => a.debater_id === dropId)
        .map((a) => ({ ...a, debater_id: keepId }));

    const teamsUpsert: Team[] = [];
    const teamsDelete: string[] = [];
    for (const t of state.teams) {
        if (t.member1_id !== dropId && t.member2_id !== dropId) continue;
        const m1 = swap(t.member1_id) as string;
        const m2 = swap(t.member2_id) as string;
        const dup = state.teams.some(
            (o) => o.id !== t.id && [o.member1_id, o.member2_id].sort().join() === [m1, m2].sort().join()
        );
        if (m1 === m2 || dup) teamsDelete.push(t.id);
        else teamsUpsert.push({ ...t, member1_id: m1, member2_id: m2 });
    }

    const people: InputPerson[] = [];
    if (drop.start_date < keep.start_date) people.push({ ...keep, start_date: drop.start_date });

    return {
        people_upsert: people,
        entries_upsert: entries,
        practice_upsert: practice,
        adjustments_upsert: adjustments,
        teams_upsert: teamsUpsert,
        teams_delete: teamsDelete,
        people_delete: [dropId],
    };
}

// ------------------------------------------------------------------- checks

export interface CheckItem {
    text: string;
    /** A person's profile, when it's about someone. */
    personId?: string;
    /** People to offer merging (keep the first). */
    merge?: [string, string];
}

export interface Check {
    id: string;
    title: string;
    /** problem: almost surely wrong; look: worth a look. */
    level: 'problem' | 'look';
    help: string;
    items: CheckItem[];
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function editDistance(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return dp[a.length][b.length];
}

const daysBetween = (a: string, b: string) =>
    Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000;

/** Likely mistakes in the data, most serious first. Empty checks are left out. */
export function dataChecks(state: State, today: string): Check[] {
    const { inputs } = state;
    const name = new Map(inputs.people.map((p) => [p.id, p.name]));
    const nameOf = (id: string | null | undefined) => (id ? name.get(id) ?? 'someone removed' : '');
    const tLabel = (t: { name: string | null; date: string }) => `${t.name || 'Unnamed'} (${t.date})`;
    const checks: Check[] = [];

    // people who were ever in the same result can't be the same person
    const together = new Set<string>();
    const pair = (a: string | null, b: string | null) => {
        if (a && b) together.add([a, b].sort().join('|'));
    };
    for (const t of inputs.tournaments) {
        const ids = t.entries.flatMap((e) => [e.debater_id, e.partner_id]).filter((x): x is string => !!x);
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pair(ids[i], ids[j]);
    }
    for (const r of inputs.practice) {
        const ids = [r.winner_id, r.winner_partner_id, r.loser_id, r.loser_partner_id].filter((x): x is string => !!x);
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pair(ids[i], ids[j]);
    }
    const dupes: CheckItem[] = [];
    const people = inputs.people;
    for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
            const a = people[i];
            const b = people[j];
            if (together.has([a.id, b.id].sort().join('|'))) continue;
            const sa = squash(a.name);
            const sb = squash(b.name);
            const close =
                sa === sb ||
                // a one-letter slip in a longer name (Zorvar, Zoravar); short names like Krish and Krisha are often two people
                (a.class_year != null && a.class_year === b.class_year && Math.min(sa.length, sb.length) >= 6 && editDistance(sa, sb) <= 1);
            if (!close) continue;
            // keep whoever has been around longer
            const [keep, drop] = a.start_date <= b.start_date ? [a, b] : [b, a];
            dupes.push({ text: `${keep.name} and ${drop.name}`, merge: [keep.id, drop.id] });
        }
    }
    if (dupes.length) {
        checks.push({
            id: 'dupe-people',
            title: 'The same person, entered twice?',
            level: 'problem',
            help: 'Names that match (or nearly match, in the same class) and never appear in the same result. Merging moves every result to one of them.',
            items: dupes,
        });
    }

    const twice: CheckItem[] = [];
    for (const t of inputs.tournaments) {
        const seen = new Map<string, number>();
        for (const e of t.entries) {
            for (const id of [e.debater_id, e.partner_id]) if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
        }
        for (const [id, n] of seen) if (n > 1) twice.push({ text: `${nameOf(id)} is in ${n} entries at ${tLabel(t)}`, personId: id });
    }
    if (twice.length) {
        checks.push({
            id: 'person-twice',
            title: 'Someone in two entries at one tournament',
            level: 'problem',
            help: 'Each person should be in one entry per tournament. Fix it from the tournament on Matches.',
            items: twice,
        });
    }

    const dupT: CheckItem[] = [];
    const ts = [...inputs.tournaments].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (let i = 0; i < ts.length; i++) {
        for (let j = i + 1; j < ts.length && daysBetween(ts[i].date, ts[j].date) <= 7; j++) {
            const a = ts[i];
            const b = ts[j];
            const sameName = !!a.name && !!b.name && squash(a.name) === squash(b.name);
            const peopleA = new Set(a.entries.flatMap((e) => [e.debater_id, e.partner_id]).filter(Boolean));
            const peopleB = b.entries.flatMap((e) => [e.debater_id, e.partner_id]).filter(Boolean);
            const shared = peopleB.filter((id) => peopleA.has(id)).length;
            const overlap = a.date === b.date && shared > 0 && shared >= Math.min(peopleA.size, peopleB.length) / 2;
            if (sameName || overlap) dupT.push({ text: `${tLabel(a)} and ${tLabel(b)}` });
        }
    }
    if (dupT.length) {
        checks.push({
            id: 'dupe-tournaments',
            title: 'The same tournament, recorded twice?',
            level: 'problem',
            help: 'Same name within a week, or the same day with mostly the same people. Delete the extra one from Matches.',
            items: dupT,
        });
    }

    const badWins: CheckItem[] = [];
    for (const t of inputs.tournaments) {
        for (const e of t.entries) {
            const who = [nameOf(e.debater_id), nameOf(e.partner_id)].filter(Boolean).join(' and ');
            if (e.raw_wins < 0) {
                badWins.push({ text: `${who} at ${tLabel(t)}: ${e.raw_wins} wins`, personId: e.debater_id });
            } else if (e.rounds != null && e.raw_wins > 3 * e.rounds) {
                // break wins count double, but even a full run can't triple the prelims
                badWins.push({ text: `${who} at ${tLabel(t)}: ${e.raw_wins} wins from ${e.rounds} rounds`, personId: e.debater_id });
            }
        }
    }
    if (badWins.length) {
        checks.push({
            id: 'bad-wins',
            title: 'Wins that can’t be right',
            level: 'problem',
            help: 'Negative wins, or more than a full run of breaks could give.',
            items: badWins,
        });
    }

    const future: CheckItem[] = [
        ...inputs.tournaments.filter((t) => t.date > today).map((t) => ({ text: tLabel(t) })),
        ...inputs.practice
            .filter((r) => r.date > today)
            .map((r) => ({ text: `Practice round on ${r.date}: ${nameOf(r.winner_id)} def. ${nameOf(r.loser_id)}` })),
    ];
    if (future.length) {
        checks.push({
            id: 'future',
            title: 'Dated in the future',
            level: 'problem',
            help: 'Results count from their date, so a typo in the year moves them out of order.',
            items: future,
        });
    }

    const gradYear = Number(seasonOf(today).slice(0, 4)) + 1;
    const overdue = inputs.people
        .filter((p) => p.status === 'active' && p.class_year != null && p.class_year < gradYear)
        .map((p) => ({ text: `${p.name}, class of ${p.class_year}`, personId: p.id }));
    if (overdue.length) {
        checks.push({
            id: 'overdue',
            title: 'Still active after their class graduated',
            level: 'look',
            help: 'Graduate them from New season, or from their row on Players.',
            items: overdue,
        });
    }

    const noYear = inputs.people
        .filter((p) => p.class_year == null)
        .map((p) => ({ text: p.name, personId: p.id }));
    if (noYear.length) {
        checks.push({
            id: 'no-class',
            title: 'No class year',
            level: 'look',
            help: 'Without one they don’t show up under a class in Analytics or graduate with their class.',
            items: noYear,
        });
    }

    const lastSeen = new Map<string, string>();
    const saw = (id: string | null | undefined, date: string) => {
        if (id && (!lastSeen.has(id) || lastSeen.get(id)! < date)) lastSeen.set(id, date);
    };
    for (const t of inputs.tournaments) for (const e of t.entries) [e.debater_id, e.partner_id].forEach((id) => saw(id, t.date));
    for (const r of inputs.practice) [r.winner_id, r.winner_partner_id, r.loser_id, r.loser_partner_id].forEach((id) => saw(id, r.date));
    const thisSeason = seasonOf(today);
    const lastSeasonStart = `${Number(thisSeason.slice(0, 4)) - 1}-07-01`;
    const quiet = inputs.people
        .filter((p) => p.status === 'active')
        .filter((p) => {
            const last = lastSeen.get(p.id);
            return last ? last < lastSeasonStart : p.start_date < lastSeasonStart;
        })
        .map((p) => ({
            text: lastSeen.get(p.id) ? `${p.name}, last result ${lastSeen.get(p.id)}` : `${p.name}, no results yet`,
            personId: p.id,
        }));
    if (quiet.length) {
        checks.push({
            id: 'quiet',
            title: 'Active, but nothing since last season',
            level: 'look',
            help: 'They may have left the team. Graduating someone keeps their history.',
            items: quiet,
        });
    }

    const solo = inputs.tournaments.flatMap((t) =>
        t.entries
            .filter((e) => !e.partner_id)
            .map((e) => ({ text: `${nameOf(e.debater_id)} at ${tLabel(t)}`, personId: e.debater_id }))
    );
    if (solo.length) {
        checks.push({
            id: 'no-partner',
            title: 'Partner not recorded',
            level: 'look',
            help: 'Their result still counts; their partner’s Elo just doesn’t move for it.',
            items: solo,
        });
    }

    return checks;
}
