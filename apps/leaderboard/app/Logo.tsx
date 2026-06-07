export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M5 21 L13 21 L10.2 26.4 L2.2 26.4 Z" fill="currentColor" opacity="0.45" />
      <path d="M8.4 13.3 L19.6 13.3 L16.8 18.7 L5.6 18.7 Z" fill="currentColor" opacity="0.72" />
      <path d="M11.8 5.6 L26.2 5.6 L23.4 11 L9 11 Z" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <Mark />
      </span>
      <span className="logo-word">
        Pharos<b>Pay</b>
      </span>
    </span>
  );
}
