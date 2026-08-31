import type { IllustrationProps } from './types';
import { toneColor, toneOpacity } from './types';

export function ScalesMotif({
    size = 100,
    tone = 'muted',
    className = '',
}: IllustrationProps) {
    const stroke = toneColor(tone);
    const opacity = toneOpacity(tone);
    return (
        <svg
            width={size}
            height={size * 0.9}
            viewBox="0 0 100 90"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            <line
                x1="50"
                y1="12"
                x2="50"
                y2="72"
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth="2"
            />
            <line
                x1="20"
                y1="28"
                x2="80"
                y2="28"
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth="2"
            />
            <path
                d="M20 28 C20 48 12 52 12 58 C12 64 28 64 28 58 C28 52 20 48 20 28"
                stroke={stroke}
                strokeOpacity={opacity * 0.8}
                strokeWidth="1.5"
            />
            <path
                d="M80 28 C80 48 88 52 88 58 C88 64 72 64 72 58 C72 52 80 48 80 28"
                stroke={stroke}
                strokeOpacity={opacity * 0.8}
                strokeWidth="1.5"
            />
            <path
                d="M42 72 H58 V82 H42 Z"
                fill={stroke}
                fillOpacity={opacity * 0.2}
                stroke={stroke}
                strokeOpacity={opacity * 0.6}
                strokeWidth="1.5"
            />
        </svg>
    );
}
