import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence } from 'motion/react';
import { addAccess, listAccess, removeAccess, type AccessEntry } from '../../auth/access';
import type { UserRole } from '../../auth/allowlist';
import { setGuestAccess } from '../../data/admin';
import { publicSettings } from '../../data/settings';
import { useAppData } from '../../state/AppDataProvider';
import { Button } from '../../components/Button';
import { Card, EmptyState } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { useToast } from '../../state/ToastProvider';

/**
 * Who can sign in, and who can record results. Adding someone is open to any
 * admin; removing an admin also needs the admin password.
 */
export function AccessTab({ actor }: { actor: string }) {
    const toast = useToast();
    const [people, setPeople] = useState<AccessEntry[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('admin');
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState<AccessEntry | null>(null);
    const [password, setPassword] = useState('');
    const [removeError, setRemoveError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!actor) return;
        try {
            setPeople(await listAccess(actor));
            setLoadError(null);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Could not load who has access.');
        }
    }, [actor]);

    useEffect(() => {
        void load();
    }, [load]);

    async function onAdd(e: FormEvent) {
        e.preventDefault();
        if (!actor || !email.trim()) return;
        setBusy(true);
        try {
            const wasViewer = people?.some((p) => p.email === email.trim().toLowerCase() && p.role === 'viewer');
            await addAccess(actor, email, role);
            toast.push(
                wasViewer && role === 'admin'
                    ? `${email.trim()} is now an admin.`
                    : `Added ${email.trim()} as ${role === 'admin' ? 'an admin' : 'a viewer'}.`,
                'success'
            );
            setEmail('');
            await load();
        } catch (err) {
            toast.push(err instanceof Error ? err.message : 'Could not add them.', 'error');
        } finally {
            setBusy(false);
        }
    }

    async function onRemove(e: FormEvent) {
        e.preventDefault();
        if (!actor || !removing) return;
        setBusy(true);
        setRemoveError(null);
        try {
            await removeAccess(actor, removing.email, removing.role === 'admin' ? password : undefined);
            toast.push(`Removed ${removing.email}.`, 'success');
            setRemoving(null);
            setPassword('');
            await load();
        } catch (err) {
            setRemoveError(err instanceof Error ? err.message : 'Could not remove them.');
        } finally {
            setBusy(false);
        }
    }

    const closeRemove = () => {
        setRemoving(null);
        setPassword('');
        setRemoveError(null);
    };

    const admins = (people ?? []).filter((p) => p.role === 'admin');
    const viewers = (people ?? []).filter((p) => p.role === 'viewer');
    const group = (title: string, list: AccessEntry[], note: string) => (
        <div className="access-group">
            <h3 className="access-group__head">
                {title}
                <span className="access-group__count">{list.length}</span>
            </h3>
            <p className="note access-group__note">{note}</p>
            {list.length === 0 ? (
                <p className="note">Nobody yet.</p>
            ) : (
                <ul className="access-list">
                    {list.map((p) => (
                        <li key={p.email} className="access-row">
                            <span className="access-row__email">
                                {p.email}
                                {p.email === actor.toLowerCase() && <span className="pill">You</span>}
                            </span>
                            <span className="access-row__by note">
                                {p.added_by && p.added_by !== 'original list' ? `Added by ${p.added_by}` : ''}
                            </span>
                            <Button variant="danger" size="sm" onClick={() => setRemoving(p)}>
                                Remove
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    return (
        <div className="access-tab">
            <Card className="access-card">
                <div className="card-title">Access</div>
                <form className="access-add" onSubmit={(e) => void onAdd(e)}>
                    <div className="field">
                        <label htmlFor="accessEmail">Google account email</label>
                        <input
                            id="accessEmail"
                            type="email"
                            autoComplete="off"
                            placeholder="name@gmail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="accessRole">Role</label>
                        <select id="accessRole" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                            <option value="admin">Admin: can record results</option>
                            <option value="viewer">Viewer: read-only</option>
                        </select>
                    </div>
                    <Button type="submit" disabled={busy || !email.trim()}>
                        {role === 'admin' ? 'Add admin' : 'Add viewer'}
                    </Button>
                </form>
                {loadError ? (
                    <EmptyState title="Couldn’t load the list" body={loadError} />
                ) : people === null ? (
                    <p className="note">Loading…</p>
                ) : (
                    <div className="access-groups">
                        {group('Admins', admins, 'Can record and fix results, and manage this list. Removing one needs the admin password.')}
                        {group('Viewers', viewers, 'Can sign in and see everything, like guests.')}
                    </div>
                )}
            </Card>

            <GuestCard actor={actor} />

            <AnimatePresence>
                {removing && (
                    <Modal title={`Remove ${removing.role === 'admin' ? 'admin' : 'viewer'}`} onClose={closeRemove}>
                        <form onSubmit={(e) => void onRemove(e)}>
                            <p style={{ marginBottom: 16 }}>
                                <strong>{removing.email}</strong> won’t be able to sign in anymore.
                                {removing.role === 'admin' && ' Removing an admin needs the admin password.'}
                            </p>
                            {removing.role === 'admin' && (
                                <div className="field">
                                    <label htmlFor="removePassword">Admin password</label>
                                    <input
                                        id="removePassword"
                                        type="password"
                                        autoComplete="off"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}
                            {removeError && (
                                <p className="access-error" role="alert">
                                    {removeError}
                                </p>
                            )}
                            <div className="row" style={{ marginTop: 8 }}>
                                <Button type="submit" variant="danger" disabled={busy}>
                                    Remove {removing.role}
                                </Button>
                                <Button type="button" variant="ghost" onClick={closeRemove}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Whether the home page offers "Browse as guest". */
function GuestCard({ actor }: { actor: string }) {
    const data = useAppData();
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    async function flip(on: boolean) {
        setBusy(true);
        try {
            await setGuestAccess(actor, on);
            void publicSettings(true);
            toast.push(on ? 'Guests can browse again.' : 'Guest browsing is off.', 'success');
            await data.refresh();
        } catch (err) {
            toast.push(err instanceof Error ? err.message : 'Could not change that.', 'error');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card className="guest-card">
            <div className="card-title">Guest view</div>
            <label className="switch">
                <input type="checkbox" checked={data.guestAccess} disabled={busy} onChange={(e) => void flip(e.target.checked)} />
                <span className="switch__track" aria-hidden="true" />
                <span>Let anyone browse as a guest</span>
            </label>
            <p className="note">
                Off hides Browse as guest on the home page and sign-in page, and sends guests to sign in. Viewers and admins
                aren’t affected.
            </p>
        </Card>
    );
}
