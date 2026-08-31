import { EloCurveMotif } from './EloCurveMotif';

export function EmptyChart({ size = 140, className = '' }: { size?: number; className?: string }) {
    return (
        <div className={`empty-illustration ${className}`.trim()} role="img" aria-label="Empty chart">
            <EloCurveMotif size={size} tone="muted" />
        </div>
    );
}
