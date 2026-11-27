import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from '../lib/motion';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** How long each tile spins before the first one lands, and the gap between landings. */
const SPIN_MS = 360;
const STEP_MS = 75;
/** How often a spinning tile shows a new letter. */
const TICK_MS = 55;

/**
 * Text on split-flap scoreboard tiles. When it scrolls into view, every tile
 * spins through letters and they land left to right; pointing at it (or
 * focusing it) runs the board again. The real letters are always in the page,
 * so if the motion never runs, or is turned off, the name simply reads.
 */
export function FlapText({ text, className = '' }: { text: string; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const running = useRef(false);
    const reduced = useReducedMotion();

    const play = useCallback(() => {
        const root = ref.current;
        if (!root || reduced || running.current) return;
        const tiles = [...root.querySelectorAll<HTMLElement>('.flap__tile')];
        const faces = tiles.map((t) => t.firstChild as Text | null);
        running.current = true;
        const t0 = performance.now();
        let last = 0;
        let frame = 0;
        const tick = (now: number) => {
            const spin = now - last >= TICK_MS;
            if (spin) last = now;
            let done = true;
            tiles.forEach((tile, i) => {
                const face = faces[i];
                const final = tile.dataset.c ?? '';
                if (!face) return;
                if (now - t0 >= SPIN_MS + i * STEP_MS) {
                    if (tile.classList.contains('is-spinning')) {
                        face.nodeValue = final;
                        tile.classList.remove('is-spinning');
                        // restart the landing flick
                        tile.classList.remove('is-landed');
                        void tile.offsetWidth;
                        tile.classList.add('is-landed');
                    }
                } else {
                    done = false;
                    tile.classList.add('is-spinning');
                    if (spin) face.nodeValue = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
                }
            });
            if (done) running.current = false;
            else frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
            tiles.forEach((tile, i) => {
                const face = faces[i];
                if (face) face.nodeValue = tile.dataset.c ?? '';
                tile.classList.remove('is-spinning');
            });
            running.current = false;
        };
    }, [reduced]);

    // the first run waits until the name is properly on screen
    useEffect(() => {
        const root = ref.current;
        if (!root || reduced || typeof IntersectionObserver === 'undefined') return;
        let stop: (() => void) | undefined;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    io.disconnect();
                    stop = play();
                }
            },
            { threshold: 0.6 }
        );
        io.observe(root);
        return () => {
            io.disconnect();
            stop?.();
        };
    }, [play, reduced]);

    return (
        <span
            ref={ref}
            className={`flap ${className}`.trim()}
            onPointerEnter={() => play()}
        >
            <span className="sr-only">{text}</span>
            <span className="flap__tiles" aria-hidden="true">
                {[...text.toUpperCase()].map((c, i) =>
                    c === ' ' ? (
                        <span key={i} className="flap__gap" />
                    ) : (
                        <span key={i} className="flap__tile" data-c={c}>
                            {c}
                        </span>
                    )
                )}
            </span>
        </span>
    );
}
