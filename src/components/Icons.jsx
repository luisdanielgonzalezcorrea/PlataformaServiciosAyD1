import { useId } from "react";
// Íconos sencillos en SVG (reemplazan los emojis). Solo presentación.
export function LogoMark({ size = 32 }) {
  // Sello del calendario: página marfil con banda dorada y visto, sobre vino tinto.
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5C1A33" />
          <stop offset="1" stopColor="#2B0A17" />
        </linearGradient>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EBCF8A" />
          <stop offset="1" stopColor="#B98A2F" />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <rect x="9" y="9" width="22" height="24" rx="4.5" />
        </clipPath>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${id}-g)`} />
      <rect x="9" y="9" width="22" height="24" rx="4.5" fill="#F6EFDF" />
      <g clipPath={`url(#${id}-c)`}>
        <rect x="9" y="9" width="22" height="7.2" fill={`url(#${id}-a)`} />
      </g>
      <rect x="14" y="6" width="2.6" height="6" rx="1.3" fill="#F6EFDF" stroke="#2B0A17" strokeWidth="1" />
      <rect x="23.4" y="6" width="2.6" height="6" rx="1.3" fill="#F6EFDF" stroke="#2B0A17" strokeWidth="1" />
      <path d="M14.3 24.2l4 4 7.6-8.2" fill="none" stroke="#5C1A33" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClockIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.6V8l2.3 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PinIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M8 14.2s4.6-4.1 4.6-7.6A4.6 4.6 0 0 0 3.4 6.6C3.4 10.1 8 14.2 8 14.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="8" cy="6.6" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function CheckSeal({ size = 64 }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle className="seal__disc" cx="32" cy="32" r="30" />
      <path className="seal__check" d="M19 33.5l9.5 9.5L46 24" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
