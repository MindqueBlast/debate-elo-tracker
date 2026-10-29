type Variant = 'cinematic' | 'app' | 'login';

/** The page's ground: one flat surface, nothing drawn on it. */
export function AppBackground({ variant = 'app' }: { variant?: Variant }) {
    return <div className={`app-background app-background--${variant}`} aria-hidden="true" />;
}
