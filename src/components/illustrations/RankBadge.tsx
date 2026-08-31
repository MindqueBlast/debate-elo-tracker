import type { IllustrationProps } from './types';
import { toneColor, toneOpacity } from './types';

export function RankBadge({
    size = 48,
    tone = 'gold',
    rank = 1,
    className = '',
}: IllustrationProps & { rank?: number }) {
    const stroke = toneColor(tone);
    const opacity = toneOpacity(tone);
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            <path
                d="M24 4 L28 16 H40 L30 24 L34 36 L24 28 L14 36 L18 24 L8 16 H20 Z"
                fill={stroke}
                fillOpacity={opacity * 0.2}
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <text
                x="24"
                y="26"
                textAnchor="middle"
                fill={stroke}
                fillOpacity={opacity}
                fontSize="12"
                fontWeight="600"
                fontFamily="var(--font)"
            >
                {rank}
            </text>
        </svg>
    );
}
