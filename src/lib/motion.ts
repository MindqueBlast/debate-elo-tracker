import { useSyncExternalStore } from 'react';

export const DURATIONS = {
    fast: 0.15,
    base: 0.18,
    chart: 0.2,
} as const;

export const EASE = [0.2, 0.8, 0.2, 1] as const;

function subscribeReducedMotion(onStoreChange: () => void) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onStoreChange);
    return () => mq.removeEventListener('change', onStoreChange);
}

function getReducedMotionSnapshot() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot() {
    return false;
}

export function useReducedMotion() {
    return useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot
    );
}

export function shouldAnimateDecorative(reduced: boolean) {
    return !reduced;
}

export function motionTransition(
    reduced: boolean,
    duration: number = DURATIONS.base
) {
    return reduced
        ? { duration: 0 }
        : { duration, ease: EASE };
}

export const fadeVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

export const fadeUpVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 },
};

export const popVariants = {
    initial: { opacity: 0, scale: 0.98, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 4 },
};

export const toastVariants = {
    initial: { opacity: 0, y: -6, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -4, scale: 0.98 },
};
