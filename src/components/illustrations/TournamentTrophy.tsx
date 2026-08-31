import type { IllustrationProps } from './types';
import { toneColor, toneOpacity } from './types';

export function TournamentTrophy({
    size = 80,
    tone = 'gold',
    className = '',
}: IllustrationProps) {
    const stroke = toneColor(tone);
    const opacity = toneOpacity(tone);
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 80 80"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            <path
                d="M24 16 H56 V32 C56 42 48 48 40 48 C32 48 24 42 24 32 Z"
                fill={stroke}
                fillOpacity={opacity * 0.2}
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth="1.5"
            />
            <path
                d="M16 20 H24 V28 C24 32 20 32 16 28 Z"
                stroke={stroke}
                strokeOpacity={opacity * 0.7}
                strokeWidth="1.5"
            />
            <path
                d="M64 20 H56 V28 C56 32 60 32 64 28 Z"
                stroke={stroke}
                strokeOpacity={opacity * 0.7}
                strokeWidth="1.5"
            />
            <path
                d="M34 48 H46 V56 H34 Z"
                stroke={stroke}
                strokeOpacity={opacity * 0.6}
                strokeWidth="1.5"
            />
            <path
                d="M28 56 H52 V64 H28 Z"
                fill={stroke}
                fillOpacity={opacity * 0.15}
                stroke={stroke}
                strokeOpacity={opacity * 0.6}
                strokeWidth="1.5"
            />
        </svg>
    );
}
