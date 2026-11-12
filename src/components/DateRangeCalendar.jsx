import { useState } from "react";
import { inRange, monthGrid, nextRangeClick } from "../utils/sprint3";
import { monthName, todayISO } from "../utils/dates";

const HEAD = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Calendario para elegir un día o un rango de días (clic en el primero y clic en el último).
 * `marked` son fechas ya bloqueadas que conocemos; solo se pintan, no se pueden elegir.
 */
export default function DateRangeCalendar({ from, to, onChange, marked = [] }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const today = todayISO();
  const cells = monthGrid(view.year, view.month);
  const blocked = new Set(marked);

  function shift(delta) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }
  const atCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();

  return (
    <div className="rcal" role="group" aria-label="Calendario para elegir fechas">
      <div className="rcal__nav">
        <button type="button" className="rcal__arrow" onClick={() => shift(-1)} disabled={atCurrentMonth} aria-label="Mes anterior">‹</button>
        <strong>{monthName(view.month)} {view.year}</strong>
        <button type="button" className="rcal__arrow" onClick={() => shift(1)} aria-label="Mes siguiente">›</button>
      </div>
      <div className="rcal__grid rcal__grid--head" aria-hidden="true">
        {HEAD.map((h) => <span key={h}>{h}</span>)}
      </div>
      <div className="rcal__grid">
        {cells.map((iso, i) => {
          if (!iso) return <span key={`b${i}`} />;
          const past = iso < today;
          const isBlocked = blocked.has(iso);
          const selected = inRange(iso, from, to);
          const edge = iso === from || iso === (to || from);
          const cls = ["rcal__day", selected && "is-in", edge && "is-edge", isBlocked && "is-blocked", iso === today && "is-today"].filter(Boolean).join(" ");
          return (
            <button key={iso} type="button" className={cls} disabled={past || isBlocked}
              aria-pressed={selected} aria-label={`${Number(iso.slice(8))} de ${monthName(view.month)}${isBlocked ? ", ya bloqueado" : ""}`}
              onClick={() => onChange(nextRangeClick({ from, to }, iso))}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <ul className="rcal__legend">
        <li><i className="rcal__dot rcal__dot--in" /> Seleccionado</li>
        <li><i className="rcal__dot rcal__dot--blocked" /> Ya bloqueado</li>
      </ul>
    </div>
  );
}
