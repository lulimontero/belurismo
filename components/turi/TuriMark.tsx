export default function TuriMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="11" cy="12" rx="2.5" ry="3.2" fill="currentColor" />
      <ellipse cx="23" cy="12" rx="2.5" ry="3.2" fill="currentColor" />
      <path
        d="M8 21Q17 30 26 21"
        stroke="var(--turi-mint, #00ffb2)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
