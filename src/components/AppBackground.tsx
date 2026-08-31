import { EloCurveMotif } from './illustrations/EloCurveMotif';
import { ScalesMotif } from './illustrations/ScalesMotif';

type Variant = 'cinematic' | 'app' | 'login';

export function AppBackground({ variant = 'app' }: { variant?: Variant }) {
    const intensity =
        variant === 'cinematic' ? 1 : variant === 'login' ? 0.75 : 0.55;

    return (
        <div className={`app-background app-background--${variant}`} aria-hidden="true">
            <div className="app-background__wash" />
            <svg
                className="app-background__svg app-background__svg--far"
                viewBox="0 0 1440 900"
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    <linearGradient id="bgCurveGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.08 * intensity} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.35 * intensity} />
                    </linearGradient>
                </defs>
                <path
                    d="M-40 680 C 200 620, 320 520, 480 480 S 880 420, 1200 320 S 1480 200, 1520 120"
                    stroke="url(#bgCurveGrad)"
                    strokeWidth={variant === 'cinematic' ? 3 : 2}
                    fill="none"
                    opacity={0.7 * intensity}
                />
                <path
                    d="M-20 760 C 240 700, 400 600, 560 580 S 920 500, 1280 400"
                    stroke="var(--accent)"
                    strokeOpacity={0.06 * intensity}
                    strokeWidth="1.5"
                    fill="none"
                />
                {variant === 'cinematic' && (
                    <path
                        d="M200 200 L280 120 L360 200 L280 280 Z"
                        stroke="currentColor"
                        strokeOpacity={0.04}
                        strokeWidth="1.5"
                        fill="var(--accent)"
                        fillOpacity={0.03}
                    />
                )}
            </svg>
            <svg
                className="app-background__svg app-background__svg--mid"
                viewBox="0 0 1440 900"
                preserveAspectRatio="xMidYMid slice"
            >
                <circle cx="1200" cy="180" r="120" fill="var(--gold)" fillOpacity={0.04 * intensity} />
                <circle cx="180" cy="640" r="80" fill="var(--accent)" fillOpacity={0.05 * intensity} />
                <circle cx="1080" cy="720" r="60" fill="var(--chart-2)" fillOpacity={0.04 * intensity} />
            </svg>
            <div className="app-background__motifs">
                <EloCurveMotif
                    size={variant === 'cinematic' ? 200 : 140}
                    tone="muted"
                    className="app-background__motif app-background__motif--left"
                />
                {variant !== 'app' && (
                    <ScalesMotif
                        size={variant === 'cinematic' ? 120 : 90}
                        tone="muted"
                        className="app-background__motif app-background__motif--right"
                    />
                )}
            </div>
            <div className="app-background__vignette" />
        </div>
    );
}
