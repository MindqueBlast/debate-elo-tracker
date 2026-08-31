import { DebatePodium } from './DebatePodium';

export function EmptyMatches({ size = 100, className = '' }: { size?: number; className?: string }) {
    return (
        <div className={`empty-illustration ${className}`.trim()} role="img" aria-label="No matches">
            <DebatePodium size={size} tone="muted" />
        </div>
    );
}
