import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';
import {
    DURATIONS,
    motionEnterInitial,
    popVariants,
    useReducedMotion,
    motionTransition,
} from '../lib/motion';

export function Modal({
    title,
    children,
    onClose,
}: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}) {
    const reduced = useReducedMotion();
    const transition = motionTransition(reduced, DURATIONS.base);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <motion.div
            className="modal-backdrop"
            onClick={onClose}
            role="presentation"
            initial={motionEnterInitial(reduced, { opacity: 0 })}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
        >
            <motion.div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onClick={(e) => e.stopPropagation()}
                initial={motionEnterInitial(reduced, popVariants.initial)}
                animate={popVariants.animate}
                exit={popVariants.exit}
                transition={transition}
            >
                <div className="modal-header">
                    <h2 id="modal-title">{title}</h2>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </div>
                {children}
            </motion.div>
        </motion.div>
    );
}
