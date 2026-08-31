import { useEffect } from 'react';
import { Button } from './Button';

export function Modal({
    title,
    children,
    onClose,
}: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="modal-backdrop" onClick={onClose} role="presentation">
            <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 16,
                    }}
                >
                    <h2 id="modal-title">{title}</h2>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </div>
                {children}
            </div>
        </div>
    );
}
