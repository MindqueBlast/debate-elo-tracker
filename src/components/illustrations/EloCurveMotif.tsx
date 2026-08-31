import type { IllustrationProps } from './types';
import { toneColor, toneOpacity } from './types';

export function EloCurveMotif({
    size = 120,
    tone = 'muted',
    className = '',
    animated = false,
}: IllustrationProps) {
    const stroke = toneColor(tone);
    const opacity = toneOpacity(tone);
    return (
        <svg
            width={size}
            height={size * 0.75}
            viewBox="0 0 160 120"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            <path
                d="M8 96 L8 16 M8 96 L152 96"
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeWidth="1.5"
            />
            {[32, 56, 80].map((y) => (
                <line
                    key={y}
                    x1="8"
                    x2="152"
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.06}
                />
            ))}
            <path
                d="M16 88 C 40 82, 52 48, 76 44 S 108 68, 132 28 S 148 20, 152 16"
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={animated ? 280 : undefined}
                strokeDashoffset={animated ? 280 : undefined}
            >
                {animated && (
                    <animate
                        attributeName="stroke-dashoffset"
                        values="280;0"
                        dur="2.4s"
                        fill="freeze"
                    />
                )}
            </path>
            <circle cx="76" cy="44" r="4" fill={stroke} fillOpacity={opacity * 0.8} />
        </svg>
    );
}
