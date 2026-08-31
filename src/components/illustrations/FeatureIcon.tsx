import type { IllustrationProps } from './types';
import { toneColor, toneOpacity } from './types';

type FeatureIconKind =
    | 'rankings'
    | 'matches'
    | 'chart'
    | 'profile'
    | 'analytics'
    | 'tournament';

export function FeatureIcon({
    kind,
    size = 40,
    tone = 'accent',
    className = '',
}: IllustrationProps & { kind: FeatureIconKind }) {
    const stroke = toneColor(tone);
    const opacity = toneOpacity(tone);

    const common = {
        width: size,
        height: size,
        viewBox: '0 0 40 40',
        fill: 'none',
        className,
        'aria-hidden': true as const,
    };

    switch (kind) {
        case 'rankings':
            return (
                <svg {...common}>
                    {[8, 16, 24].map((y, i) => (
                        <rect
                            key={y}
                            x={6 + i * 4}
                            y={y}
                            width={28 - i * 6}
                            height="6"
                            rx="2"
                            fill={stroke}
                            fillOpacity={opacity * (0.25 + i * 0.1)}
                            stroke={stroke}
                            strokeOpacity={opacity * 0.5}
                            strokeWidth="1"
                        />
                    ))}
                </svg>
            );
        case 'matches':
            return (
                <svg {...common}>
                    <path
                        d="M8 20 H32 M20 8 V32"
                        stroke={stroke}
                        strokeOpacity={opacity}
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <circle cx="12" cy="20" r="4" fill={stroke} fillOpacity={opacity * 0.4} />
                    <circle cx="28" cy="20" r="4" fill={stroke} fillOpacity={opacity * 0.6} />
                </svg>
            );
        case 'chart':
            return (
                <svg {...common}>
                    <path
                        d="M6 30 L6 10 M6 30 L34 30"
                        stroke="currentColor"
                        strokeOpacity={0.2}
                        strokeWidth="1.5"
                    />
                    <path
                        d="M10 24 L16 18 L22 22 L30 12"
                        stroke={stroke}
                        strokeOpacity={opacity}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            );
        case 'profile':
            return (
                <svg {...common}>
                    <circle cx="20" cy="14" r="6" stroke={stroke} strokeOpacity={opacity} strokeWidth="1.5" />
                    <path
                        d="M8 34 C8 26 14 22 20 22 C26 22 32 26 32 34"
                        stroke={stroke}
                        strokeOpacity={opacity * 0.8}
                        strokeWidth="1.5"
                    />
                </svg>
            );
        case 'analytics':
            return (
                <svg {...common}>
                    <rect x="6" y="8" width="8" height="24" rx="2" fill={stroke} fillOpacity={opacity * 0.3} />
                    <rect x="16" y="14" width="8" height="18" rx="2" fill={stroke} fillOpacity={opacity * 0.5} />
                    <rect x="26" y="10" width="8" height="22" rx="2" fill={stroke} fillOpacity={opacity * 0.7} />
                </svg>
            );
        case 'tournament':
            return (
                <svg {...common}>
                    <path
                        d="M14 10 H26 V18 C26 22 22 24 20 24 C18 24 14 22 14 18 Z"
                        fill={stroke}
                        fillOpacity={opacity * 0.25}
                        stroke={stroke}
                        strokeOpacity={opacity}
                        strokeWidth="1.5"
                    />
                    <path d="M18 24 H22 V28 H18 Z" stroke={stroke} strokeOpacity={opacity * 0.6} strokeWidth="1.5" />
                    <path
                        d="M14 28 H26 V32 H14 Z"
                        fill={stroke}
                        fillOpacity={opacity * 0.15}
                        stroke={stroke}
                        strokeOpacity={opacity * 0.5}
                        strokeWidth="1.5"
                    />
                </svg>
            );
    }
}
