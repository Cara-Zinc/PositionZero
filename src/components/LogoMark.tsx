interface LogoMarkProps {
  size?: number;
}

/** A single-color knight silhouette folded into a zero-like mark. */
export function LogoMark({ size = 30 }: LogoMarkProps) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Position Zero chess mark">
      <rect width="40" height="40" fill="currentColor" />
      <path fill="var(--paper)" d="M10 31h20v3H10zM13 28h17v3H13zM15 27c1-5 4-7 3-11l-3-5 8-5 8 7-4 5c3 3 4 6 4 9H15Zm5-12 5-1 3-2-5-4-4 3 2 4Z" />
      <circle cx="25.5" cy="10.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
