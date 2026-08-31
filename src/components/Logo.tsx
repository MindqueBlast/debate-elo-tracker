export function Logo({ size = 22 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
        >
            <rect
                x="1.5"
                y="1.5"
                width="29"
                height="29"
                rx="8"
                stroke="currentColor"
                strokeOpacity="0.25"
            />
            <path
                d="M7 21.5 L13 12.5 L18 17 L25 8"
                stroke="#dc3b3b"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="25" cy="8" r="2" fill="#dc3b3b" />
        </svg>
    );
}
