import type { IllustrationProps } from './types';
import { toneColor, toneOpacity } from './types';

export function EmptyRoster({
    size = 120,
    tone = 'muted',
    className = '',
}: IllustrationProps) {
    const stroke = toneColor(tone);
    const opacity = toneOpacity(tone);
    return (
        <svg
            width={size}
            height={size * 0.85}
            viewBox="0 0 120 102"
            fill="none"
            className={className}
            role="img"
            aria-label="Empty roster"
        >
            <circle cx="60" cy="32" r="16" stroke={stroke} strokeOpacity={opacity} strokeWidth="1.5" />
            <path
                d="M32 88 C32 68 44 58 60 58 C76 58 88 68 88 88"
                stroke={stroke}
                strokeOpacity={opacity * 0.8}
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <circle cx="28" cy="40" r="10" stroke={stroke} strokeOpacity={opacity * 0.4} strokeWidth="1.5" />
            <circle cx="92" cy="40" r="10" stroke={stroke} strokeOpacity={opacity * 0.4} strokeWidth="1.5" />
        </svg>
    );
}
