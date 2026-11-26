import type { CSSProperties, ReactNode } from 'react';

export function Card({
    children,
    className = '',
    style,
}: {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
}) {
    return (
        <section className={`card ${className}`.trim()} style={style}>
            {children}
        </section>
    );
}

/** A page's title in the display face over a heavy rule, with an optional line under it. */
export function PageHeader({
    title,
    sub,
    actions,
}: {
    title: string;
    sub?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header className="page-header">
            <div className="page-header__titles">
                <h1>{title}</h1>
                {sub && <p className="page-header__sub">{sub}</p>}
            </div>
            {actions}
        </header>
    );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div className="empty">
            <strong>{title}</strong>
            <p>{body}</p>
        </div>
    );
}

/** One figure on the scoreboard strip (sits inside .stat-grid). */
export function StatCard({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="stat">
            <div className="stat-label">{label}</div>
            <div className="stat-value num">{value}</div>
        </div>
    );
}
