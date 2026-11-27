import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { listChanges } from '../../data/admin';
import { undoChange, type LoggedChange } from '../../data/mutations';
import { useAppData } from '../../state/AppDataProvider';
import { useToast } from '../../state/ToastProvider';
import { Button } from '../../components/Button';
import { Card, EmptyState } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';

const when = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Every save since the log started, newest first, each with an Undo while it still can be. */
export function LogTab({ actor }: { actor: string }) {
    const data = useAppData();
    const toast = useToast();
    const [limit, setLimit] = useState(60);
    const [entries, setEntries] = useState<LoggedChange[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [undoing, setUndoing] = useState<LoggedChange | null>(null);

    const load = useCallback(async () => {
        try {
            setEntries(await listChanges(actor, limit));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load the change log.');
        }
    }, [actor, limit]);

    useEffect(() => {
        void load();
        // a save anywhere in the app moves the revision; reload the log with it
    }, [load, data.revision]);

    return (
        <Card>
            <div className="card-title">Change log</div>
            <p className="note card-lead">
                Every save, newest first. Undo puts the results back and recalculates everyone.
            </p>
            {error ? (
                <EmptyState title="Couldn’t load the change log" body={error} />
            ) : entries === null ? (
                <p className="note">Loading…</p>
            ) : entries.length === 0 ? (
                <EmptyState title="Nothing yet" body="Saves show up here from now on." />
            ) : (
                <ol className="log-list">
                    {entries.map((e) => (
                        <li key={e.id} className={`log-row${e.undone_at ? ' is-undone' : ''}`}>
                            <span className="log-row__when num note">{when(e.created_at)}</span>
                            <span className="log-row__what">
                                <strong>{e.action}</strong>
                                <span className="note">{e.actor ?? 'Someone'}</span>
                            </span>
                            <span className="log-row__undo">
                                {e.undone_at ? (
                                    <span className="pill">Undone{e.undone_by ? ` by ${e.undone_by.split('@')[0]}` : ''}</span>
                                ) : e.undoable ? (
                                    <Button size="sm" variant="secondary" onClick={() => setUndoing(e)}>
                                        Undo
                                    </Button>
                                ) : null}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            {entries && entries.length >= limit && (
                <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + 60)}>
                    Show older
                </Button>
            )}

            <AnimatePresence>
                {undoing && (
                    <ConfirmModal
                        title="Undo this change"
                        confirmLabel="Undo it"
                        onClose={() => setUndoing(null)}
                        onConfirm={async () => {
                            await undoChange(data, undoing);
                            toast.push(`Undid: ${undoing.action}`, 'success');
                            await data.refresh();
                        }}
                    >
                        <p>
                            <strong>{undoing.action}</strong> is taken back and everyone is recalculated. The undo shows up in the log
                            too.
                        </p>
                    </ConfirmModal>
                )}
            </AnimatePresence>
        </Card>
    );
}
