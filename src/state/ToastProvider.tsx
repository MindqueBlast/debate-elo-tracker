import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    DURATIONS,
    toastVariants,
    useReducedMotion,
    motionTransition,
} from '../lib/motion';

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
    const reduced = useReducedMotion();
    const transition = motionTransition(reduced, DURATIONS.fast);

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
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            className={`toast toast-${t.kind}`}
                            initial={toastVariants.initial}
                            animate={toastVariants.animate}
                            exit={toastVariants.exit}
                            transition={transition}
                            layout
                        >
                            {t.message}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
