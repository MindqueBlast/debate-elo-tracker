import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';

export interface SegmentedOption<T extends string> {
    value: T;
    label: ReactNode;
}

/**
 * A switch between views. The inked thumb slides to the option you pick, so
 * it's clear what changed; with reduced motion it just moves.
 */
export function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
    className = '',
}: {
    label: string;
    value: T;
    options: SegmentedOption<T>[];
    onChange: (value: T) => void;
    className?: string;
}) {
    const id = useId();
    return (
        <div className={`segmented ${className}`.trim()} role="group" aria-label={label}>
            {options.map((o) => {
                const on = o.value === value;
                return (
                    <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}>
                        {on && (
                            <motion.span
                                layoutId={`seg-${id}`}
                                className="segmented__thumb"
                                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                                aria-hidden="true"
                            />
                        )}
                        <span className="segmented__label">{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
