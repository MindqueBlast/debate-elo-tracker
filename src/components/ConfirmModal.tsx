import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * A yes/no for a big change, with the admin password when it needs one. The
 * error from a failed try (wrong password, someone else saved) shows inside,
 * so they can fix it without starting over.
 */
export function ConfirmModal({
    title,
    children,
    confirmLabel,
    danger = false,
    password = false,
    onConfirm,
    onClose,
}: {
    title: string;
    children: ReactNode;
    confirmLabel: string;
    danger?: boolean;
    /** Ask for the admin password and pass it on. */
    password?: boolean;
    onConfirm: (password: string) => Promise<void>;
    onClose: () => void;
}) {
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await onConfirm(value);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'That didn’t work. Try again.');
            setBusy(false);
        }
    }

    return (
        <Modal title={title} onClose={busy ? () => undefined : onClose}>
            <form onSubmit={(e) => void submit(e)}>
                <div className="confirm-body">{children}</div>
                {password && (
                    <div className="field">
                        <label htmlFor="confirmPassword">Admin password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            autoComplete="off"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}
                {error && (
                    <p className="access-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="row" style={{ marginTop: 8 }}>
                    <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy || (password && !value)}>
                        {busy ? 'Working…' : confirmLabel}
                    </Button>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
