import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { getLocalDateString, graduatingYear, planNewSeason } from '../../domain';
import { startNewSeason } from '../../data/mutations';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import { Button } from '../../components/Button';
import { Card, EmptyState } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';

/**
 * End of the year in one step: graduate a class and move everyone else up a
 * division. Everyone starts ticked; untick anyone who isn't moving.
 */
export function SeasonTab() {
    const data = useAppData();
    const toast = useToast();
    const thisYear = graduatingYear(getLocalDateString());
    const years = useMemo(() => {
        const ys = new Set<number>([thisYear]);
        for (const p of data.inputs.people) {
            if (p.status === 'active' && p.class_year != null && p.class_year <= thisYear + 1) ys.add(p.class_year);
        }
        return [...ys].sort((a, b) => a - b);
    }, [data.inputs.people, thisYear]);
    const [year, setYear] = useState(thisYear);
    const plan = useMemo(() => planNewSeason(data.inputs, year), [data.inputs, year]);
    const [skipGrad, setSkipGrad] = useState<Set<string>>(new Set());
    const [skipUp, setSkipUp] = useState<Set<string>>(new Set());
    const [confirming, setConfirming] = useState(false);

    const graduate = plan.graduating.filter((p) => !skipGrad.has(p.id)).map((p) => p.id);
    const moveUp = plan.movingUp.filter((m) => !skipUp.has(m.person.id)).map((m) => m.person.id);

    const flip = (set: Set<string>, id: string) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    };

    const nothing = plan.graduating.length + plan.movingUp.length === 0;

    return (
        <Card>
            <div className="card-title">End of the year</div>
            <p className="note season-intro">
                Graduate a class and move everyone else up a division, in one step. A backup is taken first, and the change log
                can undo it. Seasons themselves turn over on their own: results from July 1 count toward the next one.
            </p>
            <div className="field season-year">
                <label htmlFor="gradYear">Graduating class</label>
                <select id="gradYear" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => (
                        <option key={y} value={y}>
                            Class of {y}
                            {y < thisYear ? ' (overdue)' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {nothing ? (
                <EmptyState title="Nobody to move" body="No one active is in that class, and nobody below varsity is left to move up." />
            ) : (
                <div className="season-cols">
                    <section aria-labelledby="season-grad">
                        <div className="season-col__head">
                            <h3 id="season-grad">Graduating</h3>
                            <span className="note">
                                {graduate.length} of {plan.graduating.length}
                            </span>
                            <button type="button" className="text-btn" onClick={() => setSkipGrad(new Set())}>
                                All
                            </button>
                            <button
                                type="button"
                                className="text-btn"
                                onClick={() => setSkipGrad(new Set(plan.graduating.map((p) => p.id)))}
                            >
                                None
                            </button>
                        </div>
                        {plan.graduating.length === 0 ? (
                            <p className="note">Nobody active in the class of {year}.</p>
                        ) : (
                            <ul className="tick-list">
                                {plan.graduating.map((p) => (
                                    <li key={p.id}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={!skipGrad.has(p.id)}
                                                onChange={() => setSkipGrad((s) => flip(s, p.id))}
                                            />
                                            <span className="tick-list__name">{p.name}</span>
                                            <span className="pill">{p.division ?? 'No division'}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <section aria-labelledby="season-up">
                        <div className="season-col__head">
                            <h3 id="season-up">Moving up a division</h3>
                            <span className="note">
                                {moveUp.length} of {plan.movingUp.length}
                            </span>
                            <button type="button" className="text-btn" onClick={() => setSkipUp(new Set())}>
                                All
                            </button>
                            <button
                                type="button"
                                className="text-btn"
                                onClick={() => setSkipUp(new Set(plan.movingUp.map((m) => m.person.id)))}
                            >
                                None
                            </button>
                        </div>
                        {plan.movingUp.length === 0 ? (
                            <p className="note">Everyone else is already varsity.</p>
                        ) : (
                            <ul className="tick-list">
                                {plan.movingUp.map(({ person, to }) => (
                                    <li key={person.id}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={!skipUp.has(person.id)}
                                                onChange={() => setSkipUp((s) => flip(s, person.id))}
                                            />
                                            <span className="tick-list__name">{person.name}</span>
                                            <span className="note">
                                                {person.division} to {to}
                                            </span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            )}

            <div className="row season-actions">
                <Button disabled={graduate.length + moveUp.length === 0} onClick={() => setConfirming(true)}>
                    Graduate {graduate.length}, move up {moveUp.length}
                </Button>
            </div>

            <AnimatePresence>
                {confirming && (
                    <ConfirmModal
                        title="Start the new season"
                        confirmLabel={`Graduate ${graduate.length}, move up ${moveUp.length}`}
                        password
                        onClose={() => setConfirming(false)}
                        onConfirm={async (password) => {
                            await startNewSeason(data, year, { graduate, moveUp }, password);
                            toast.push(`Graduated ${graduate.length} and moved ${moveUp.length} up a division.`, 'success');
                            setSkipGrad(new Set());
                            setSkipUp(new Set());
                            await data.refresh();
                        }}
                    >
                        <p>
                            {graduate.length} {graduate.length === 1 ? 'person graduates' : 'people graduate'} (dated June 30,{' '}
                            {year}, and their saved teams come off the active list), and {moveUp.length}{' '}
                            {moveUp.length === 1 ? 'person moves' : 'people move'} up a division. Nobody’s Elo changes.
                        </p>
                    </ConfirmModal>
                )}
            </AnimatePresence>
        </Card>
    );
}
