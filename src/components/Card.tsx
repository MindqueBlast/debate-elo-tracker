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

export function PageHeader({
    kicker,
    title,
    actions,
}: {
    kicker: string;
    title: string;
    actions?: ReactNode;
}) {
    return (
        <header className="page-header">
            <div>
                <div className="page-kicker">{kicker}</div>
                <h1>{title}</h1>
            </div>
            {actions}
        </header>
    );
}

export function EmptyState({
    title,
    body,
}: {
    title: string;
    body: string;
}) {
    return (
        <div className="empty">
            <strong>{title}</strong>
            <p>{body}</p>
        </div>
    );
}

export function StatCard({
    label,
    value,
}: {
    label: string;
    value: ReactNode;
}) {
    return (
        <Card className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value num">{value}</div>
        </Card>
    );
}
