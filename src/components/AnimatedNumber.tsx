import { useEffect, useRef, useState } from 'react';

export function AnimatedNumber({
    value,
    digits = 0,
}: {
    value: number;
    digits?: number;
}) {
    const [shown, setShown] = useState(value);
    const from = useRef(value);

    useEffect(() => {
        const reduce = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        if (reduce) {
            setShown(value);
            from.current = value;
            return;
        }
        const start = from.current;
        const delta = value - start;
        if (delta === 0) return;
        const duration = 220;
        let frame: number;
        const t0 = performance.now();
        const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / duration);
            const eased = 1 - (1 - p) ** 3;
            setShown(start + delta * eased);
            if (p < 1) frame = requestAnimationFrame(tick);
            else from.current = value;
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value]);

    return <span className="num">{shown.toFixed(digits)}</span>;
}
