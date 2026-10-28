import { useMemo } from 'react';
import {
    lookup,
    pairingEloOf,
    teamName,
    type Debater,
    type Division,
    type Team,
} from '../domain';

export interface PairingValue {
    mode: 'none' | 'team' | 'custom';
    teamId: string | null;
    members: [string, string];
}

export const EMPTY_PAIRING: PairingValue = {
    mode: 'none',
    teamId: null,
    members: ['', ''],
};

const CUSTOM = '__custom';

export function pairingOf(value: PairingValue): [string, string] | null {
    const [a, b] = value.members;
    if (!a || !b || a === b) return null;
    return [a, b];
}

/** The higher of the two people's divisions, for a sensible default. */
export function defaultDivision(
    value: PairingValue,
    teams: Team[],
    debaters: Debater[]
): Division {
    const team = value.teamId ? teams.find((t) => t.id === value.teamId) : null;
    if (team?.division) return team.division;
    const order: Division[] = ['Novice', 'JV', 'Varsity'];
    let best = 0;
    for (const id of value.members) {
        const d = debaters.find((x) => x.id === id)?.division;
        if (d) best = Math.max(best, order.indexOf(d));
    }
    return order[best];
}

export function PairingPicker({
    id,
    label,
    value,
    onChange,
    debaters,
    teams,
    exclude = [],
}: {
    id: string;
    label: string;
    value: PairingValue;
    onChange: (v: PairingValue) => void;
    /** People who can be picked (usually the active roster). */
    debaters: Debater[];
    /** Teams that can be picked (usually the active ones). */
    teams: Team[];
    /** People already used elsewhere in the form. */
    exclude?: string[];
}) {
    const byId = useMemo(() => lookup(debaters), [debaters]);
    const sortedTeams = useMemo(
        () =>
            [...teams].sort(
                (a, b) =>
                    pairingEloOf([b.member1_id, b.member2_id], byId) -
                    pairingEloOf([a.member1_id, a.member2_id], byId)
            ),
        [teams, byId]
    );
    const people = useMemo(
        () => [...debaters].sort((a, b) => a.name.localeCompare(b.name)),
        [debaters]
    );
    const blocked = new Set(exclude);
    const select = value.mode === 'team' ? value.teamId ?? '' : value.mode === 'custom' ? CUSTOM : '';

    return (
        <div className="pairing-picker">
            <div className="field">
                <label htmlFor={`${id}-team`}>{label}</label>
                <select
                    id={`${id}-team`}
                    value={select}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return onChange(EMPTY_PAIRING);
                        if (v === CUSTOM) {
                            return onChange({
                                mode: 'custom',
                                teamId: null,
                                members: value.members,
                            });
                        }
                        const team = teams.find((t) => t.id === v);
                        if (!team) return;
                        onChange({
                            mode: 'team',
                            teamId: team.id,
                            members: [team.member1_id, team.member2_id],
                        });
                    }}
                >
                    <option value="">Select a team…</option>
                    {sortedTeams.map((t) => {
                        const used =
                            blocked.has(t.member1_id) || blocked.has(t.member2_id);
                        return (
                            <option key={t.id} value={t.id} disabled={used}>
                                {teamName(t, byId)} (
                                {Math.round(pairingEloOf([t.member1_id, t.member2_id], byId))})
                            </option>
                        );
                    })}
                    <option value={CUSTOM}>Custom pairing…</option>
                </select>
            </div>
            {value.mode === 'custom' && (
                <div className="pairing-custom">
                    {[0, 1].map((slot) => (
                        <div className="field" key={slot}>
                            <label htmlFor={`${id}-p${slot}`}>
                                {slot === 0 ? 'Person 1' : 'Person 2'}
                            </label>
                            <select
                                id={`${id}-p${slot}`}
                                value={value.members[slot]}
                                onChange={(e) => {
                                    const members: [string, string] = [...value.members];
                                    members[slot] = e.target.value;
                                    onChange({ ...value, members });
                                }}
                            >
                                <option value="">Select…</option>
                                {people.map((d) => (
                                    <option
                                        key={d.id}
                                        value={d.id}
                                        disabled={
                                            d.id === value.members[1 - slot] ||
                                            blocked.has(d.id)
                                        }
                                    >
                                        {d.name} ({Math.round(d.elo)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
