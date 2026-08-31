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
    illustration,
}: {
    kicker: string;
    title: string;
    actions?: ReactNode;
    illustration?: ReactNode;
}) {
    return (
        <header className="page-header">
            <div className="page-header__main">
                {illustration && (
                    <div className="page-header__illus" aria-hidden="true">
                        {illustration}
                    </div>
                )}
                <div>
                    <div className="page-kicker">{kicker}</div>
                    <h1>{title}</h1>
                </div>
            </div>
            {actions}
        </header>
    );
}

export function EmptyState({
    title,
    body,
    illustration,
}: {
    title: string;
    body: string;
    illustration?: ReactNode;
}) {
    return (
        <div className="empty">
            {illustration && <div className="empty__illus">{illustration}</div>}
            <strong>{title}</strong>
            <p>{body}</p>
        </div>
    );
}

export function StatCard({
    label,
    value,
    accent,
}: {
    label: string;
    value: ReactNode;
    accent?: ReactNode;
}) {
    return (
        <Card className="stat-card">
            {accent && <div className="stat-card__accent" aria-hidden="true">{accent}</div>}
            <div className="stat-label">{label}</div>
            <div className="stat-value num">{value}</div>
        </Card>
    );
}
