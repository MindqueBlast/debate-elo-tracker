/**
 * The mark: a scarlet plate with a white line stepping up, the way a rating
 * climbs one tournament at a time.
 */
export function Logo({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="5" fill="#d3132b" />
            <path
                d="M6.5 23.5 H12.5 V17 H18.5 V11 H25.5"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="square"
                strokeLinejoin="miter"
            />
        </svg>
    );
}
