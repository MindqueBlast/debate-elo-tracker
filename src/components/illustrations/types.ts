export type IllustrationTone = 'muted' | 'accent' | 'gold' | 'silver' | 'bronze';

export type IllustrationProps = {
    size?: number;
    tone?: IllustrationTone;
    className?: string;
    animated?: boolean;
};

export function toneColor(tone: IllustrationTone): string {
    switch (tone) {
        case 'accent':
            return 'var(--accent)';
        case 'gold':
            return 'var(--gold)';
        case 'silver':
            return 'var(--silver)';
        case 'bronze':
            return 'var(--bronze)';
        default:
            return 'currentColor';
    }
}

export function toneOpacity(tone: IllustrationTone): number {
    return tone === 'muted' ? 0.35 : 1;
}
