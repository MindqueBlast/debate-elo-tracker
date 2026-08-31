import type { IllustrationProps } from './types';
import { toneColor, toneOpacity } from './types';

export function DebatePodium({
    size = 100,
    tone = 'accent',
    className = '',
}: IllustrationProps) {
    const stroke = toneColor(tone);
    const opacity = toneOpacity(tone);
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            <path
                d="M12 72 H88 V84 H12 Z"
                fill={stroke}
                fillOpacity={opacity * 0.15}
                stroke={stroke}
                strokeOpacity={opacity * 0.5}
                strokeWidth="1.5"
            />
            <path
                d="M28 52 H72 V72 H28 Z"
                fill={stroke}
                fillOpacity={opacity * 0.2}
                stroke={stroke}
                strokeOpacity={opacity * 0.6}
                strokeWidth="1.5"
            />
            <path
                d="M40 32 H60 V52 H40 Z"
                fill={stroke}
                fillOpacity={opacity * 0.25}
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth="1.5"
            />
            <circle cx="50" cy="22" r="8" stroke={stroke} strokeOpacity={opacity} strokeWidth="1.5" />
            <path
                d="M42 30 Q50 38 58 30"
                stroke={stroke}
                strokeOpacity={opacity * 0.7}
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
