// Íconos sencillos en SVG (reemplazan los emojis). Solo presentación.
export function LogoMark({ size = 32 }) {
  // Cuadrícula de calendario: un día "reservado" en girasol.
  const dots = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const booked = r === 1 && c === 2;
      dots.push(
        <circle
          key={`${r}${c}`}
          cx={9 + c * 7}
          cy={9 + r * 7}
          r={booked ? 2.6 : 2}
          fill={booked ? "#FFC53D" : "#FFFFFF"}
          opacity={booked ? 1 : 0.85}
        />
      );
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      <rect width="30" height="30" rx="9" fill="#0E4D3F" />
      {dots}
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
