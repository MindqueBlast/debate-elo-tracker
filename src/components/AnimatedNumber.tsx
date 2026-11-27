import { useLayoutEffect, useRef } from 'react';
import { animate } from 'motion/react';
import { useReducedMotion } from '../lib/motion';

/**
 * A figure that rolls to its value like a scoreboard. It counts from `from`
 * when it first appears (if given), and from what it showed before whenever
 * the value changes. The text is always the real value to begin with, so
 * nothing is ever left showing a stale number; with reduced motion it just
 * shows the value.
 */
export function AnimatedNumber({
    value,
    digits = 0,
    duration = 220,
    from,
    delay = 0,
}: {
    value: number;
    digits?: number;
    /** How long a change takes to count over, in ms. */
    duration?: number;
    /** Where the first count starts; without it, the first value just shows. */
    from?: number;
    /** Wait this long (ms) before counting, to line up with other motion. */
    delay?: number;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const shown = useRef<number | null>(null);
    const reduced = useReducedMotion();
    const text = value.toFixed(digits);

    useLayoutEffect(() => {
        const el = ref.current;
        // write into React's own text node, so its next render lines up with ours
        const node = el?.firstChild;
        const write = (s: string) => {
            if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = s;
            else if (el) el.textContent = s;
        };
        const start = shown.current ?? from;
        if (reduced || start === undefined || start === value || import.meta.env.MODE === 'test') {
            write(value.toFixed(digits));
            shown.current = value;
            return;
        }
        write(start.toFixed(digits));
        const controls = animate(start, value, {
            duration: duration / 1000,
            delay: delay / 1000,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (v) => {
                shown.current = v;
                write(v.toFixed(digits));
            },
            onComplete: () => {
                shown.current = value;
                write(value.toFixed(digits));
            },
        });
        return () => controls.stop();
    }, [value, digits, duration, delay, from, reduced]);

    return (
        <span ref={ref} className="num">
            {text}
        </span>
    );
}
