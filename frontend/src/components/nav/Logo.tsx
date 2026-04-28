// GroundVault wordmark — geometric house silhouette wrapping a filled
// "vault door" circle. The mark is monochrome (currentColor) so it
// inherits the parent's text color, letting TopNav use forest while
// /404 / hero contexts can override.
//
// The same SVG path is used for the favicon (frontend/public/favicon.svg)
// — keep them in sync if the geometry ever changes.

interface LogoProps {
  className?: string;
  /** Mark size in px. Defaults to 24 (TopNav). */
  size?: number;
}

export function LogoMark({ className, size = 24 }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 11 L12 3 L21 11 L21 21 L3 21 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15.5" r="3" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={22} />
      <span className="font-display text-xl tracking-tight">GroundVault</span>
    </span>
  );
}
