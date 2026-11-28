import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useActor } from '../../auth/useActor';
import { listChanges } from '../../data/admin';
import { deleteAdjustments, type LoggedChange } from '../../data/mutations';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`;

/**
 * Every Elo set by hand ("Set someone's Elo to …"), newest first, with who
 * set it, and a way to take any or all of them back. Removing one puts that
 * person back where their results alone put them.
 */
export function ManualChangesCard() {
    const data = useAppData();
    const toast = useToast();
    const actor = useActor();
    const [log, setLog] = useState<LoggedChange[]>([]);
    const [removing, setRemoving] = useState<string[] | null>(null);

    // who set each one comes from the change log
    useEffect(() => {
        if (!actor) return;
        let live = true;
        listChanges(actor, 500)
            .then((rows) => live && setLog(rows))
            .catch(() => undefined);
        return () => {
            live = false;
        };
    }, [actor, data.revision]);

    const setBy = useMemo(() => {
        const m = new Map<string, { actor: string | null; action: string }>();
        for (const e of log) {
            for (const a of e.after.adjustments_upsert ?? []) m.set(a.id, { actor: e.actor, action: e.action });
        }
        return m;
    }, [log]);

    const name = new Map(data.debaters.map((d) => [d.id, d.name]));
    const rows = [...data.inputs.adjustments].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const target = (removing ?? []).map((id) => rows.find((r) => r.id === id)).filter(Boolean);

    return (
        <Card>
            <div className="card-title">Manual Elo changes</div>
            <p className="note card-lead">
                Every Elo set by hand, newest first. Removing one puts that person back where their results alone put them, and
                the change log can undo the removal.
            </p>
            {rows.length === 0 ? (
                <p className="note">None. Setting someone’s Elo by hand shows up here.</p>
            ) : (
                <>
                    <ol className="manual-list">
                        {rows.map((a) => {
                            const by = setBy.get(a.id);
                            return (
                                <li key={a.id} className="manual-row">
                                    <span className="num note">{a.date}</span>
                                    <span className="manual-row__what">
                                        <Link to={`/app/players/${a.debater_id}`}>{name.get(a.debater_id) ?? 'Someone removed'}</Link>
                                        <span className="note">
                                            {by ? by.action.replace(/^Set .*?’s Elo to /, 'Set to ') : 'Set by hand'}
                                            {by?.actor ? `, by ${by.actor.split('@')[0]}` : ''}
                                            {a.note ? `: ${a.note}` : ''}
                                        </span>
                                    </span>
                                    <span className={`num manual-row__amount ${a.amount >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                                        {signed(a.amount)}
                                    </span>
                                    <Button size="sm" variant="secondary" onClick={() => setRemoving([a.id])}>
                                        Remove
                                    </Button>
                                </li>
                            );
                        })}
                    </ol>
                    {rows.length > 1 && (
                        <Button variant="danger" size="sm" onClick={() => setRemoving(rows.map((r) => r.id))}>
                            Remove all {rows.length}
                        </Button>
                    )}
                </>
            )}

            <AnimatePresence>
                {removing && (
                    <ConfirmModal
                        title={removing.length === 1 ? 'Remove this manual change' : `Remove all ${removing.length} manual changes`}
                        confirmLabel={removing.length === 1 ? 'Remove it' : `Remove all ${removing.length}`}
                        danger
                        onClose={() => setRemoving(null)}
                        onConfirm={async () => {
                            await deleteAdjustments(data, removing);
                            toast.push(
                                removing.length === 1 ? 'Manual change removed.' : `Removed ${removing.length} manual changes.`,
                                'success'
                            );
                            await data.refresh();
                        }}
                    >
                        <p>
                            {target.length === 1
                                ? `${name.get(target[0]!.debater_id) ?? 'They'} goes back to where their results alone put them (${signed(-target[0]!.amount)}).`
                                : 'Everyone with a manual change goes back to where their results alone put them.'}{' '}
                            Everyone is recalculated.
                        </p>
                    </ConfirmModal>
                )}
            </AnimatePresence>
        </Card>
    );
}
