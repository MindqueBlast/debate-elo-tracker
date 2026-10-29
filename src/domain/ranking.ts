import { practiceSide } from './teams';
import type { Debater, PracticeRound, RankedDebater } from './types';

export function practiceRecord(
    debaterId: string,
    rounds: PracticeRound[]
): { wins: number; losses: number; played: number; winRate: number | null } {
    let wins = 0;
    let losses = 0;
    for (const round of rounds) {
        const side = practiceSide(round, debaterId);
        if (side === 'won') wins += 1;
        else if (side === 'lost') losses += 1;
    }
    const played = wins + losses;
    return {
        wins,
        losses,
        played,
        winRate: played > 0 ? (wins / played) * 100 : null,
    };
}

export function rankDebaters(
    debaters: Debater[],
    rounds: PracticeRound[],
    options: {
        showGraduated?: boolean;
        search?: string;
        /** Only these people (e.g. everyone who competed this season). */
        only?: ReadonlySet<string>;
    } = {}
): RankedDebater[] {
    const { showGraduated = false, search = '', only } = options;
    const q = search.trim().toLowerCase();

    const sorted = [...debaters].sort((a, b) => {
        if (b.elo !== a.elo) return b.elo - a.elo;
        return a.name.localeCompare(b.name);
    });

    const visible = sorted.filter((d) => {
        if (only) {
            if (!only.has(d.id)) return false;
        } else if (!showGraduated && d.status === 'graduated') {
            return false;
        }
        if (q && !d.name.toLowerCase().includes(q)) return false;
        return true;
    });

    return visible.map((debater, index) => {
        const record = practiceRecord(debater.id, rounds);
        return {
            ...debater,
            rank: index + 1,
            ...record,
        };
    });
}
