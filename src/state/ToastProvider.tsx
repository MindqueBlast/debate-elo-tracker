import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    message: string;
    kind: ToastKind;
}

const ToastContext = createContext<{
    toasts: Toast[];
    push: (message: string, kind?: ToastKind, duration?: number) => void;
} | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const push = useCallback(
        (message: string, kind: ToastKind = 'info', duration = 3200) => {
            const id = nextId++;
            setToasts((prev) => [...prev, { id, message, kind }]);
            window.setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        },
        []
    );

    const value = useMemo(() => ({ toasts, push }), [toasts, push]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-stack" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.kind}`}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
