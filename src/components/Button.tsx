import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
    variant = 'primary',
    size,
    className = '',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: 'sm';
}) {
    const v =
        variant === 'primary'
            ? 'btn'
            : variant === 'secondary'
              ? 'btn btn-secondary'
              : variant === 'danger'
                ? 'btn btn-danger'
                : 'btn btn-ghost';
    return (
        <button
            className={`${v} ${size === 'sm' ? 'btn-sm' : ''} ${className}`.trim()}
            {...props}
        />
    );
}
