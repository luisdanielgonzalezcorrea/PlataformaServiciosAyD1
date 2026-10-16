import { useCallback, useEffect, useMemo, useState } from "react";
import { DAY_STATUS, getDaySlots, getMonthAvailability } from "../api/scheduleService";
import {
  MAX_NOTICE_DAYS, addDays, formatLongDate, formatTime, isoWeekday, monthName, todayISO,
} from "../utils/dates";

const STATUS_LABEL = {
  [DAY_STATUS.AVAILABLE]: "Disponible",
  [DAY_STATUS.PARTIAL]: "Parcialmente ocupado",
  [DAY_STATUS.FULL]: "Agotado",
  [DAY_STATUS.DISABLED]: "No habilitado",
};

const WEEK_HEADER = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function shiftMonth({ year, month }, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * HU-018 · Visualización de disponibilidad (calendario + horarios debajo)
 * HU-019 · Estado de disponibilidad por día
 * HU-020 · Horarios disponibles de la fecha
 * HU-022 / HU-023 · Se reutiliza en el paso 1 de la reserva (modo seleccionable)
 *
 * Props:
 *  - service: ServiceView
 *  - value: { date, startTime, endTime } | null
 *  - onChange(value)  -> cuando elige fecha (sin hora) o fecha+hora
 *  - selectableSlots: si es false, los horarios se muestran pero no se pueden elegir
 *  - onNoDates(bool)  -> avisa si el servicio no tiene ninguna fecha reservable próxima
 */
export default function AvailabilityPicker({
  service,
  value,
  onChange,
  selectableSlots = true,
  onNoDates,
}) {
  const now = new Date();
  const [view, setView] = useState(() => {
    if (value?.date) {
      const [y, m] = value.date.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [months, setMonths] = useState({}); // "2026-10" -> { [date]: {status, slots} }
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [monthError, setMonthError] = useState(null);

  const [daySlots, setDaySlots] = useState(null); // { slots, reason }
  const [loadingDay, setLoadingDay] = useState(false);
  const [dayError, setDayError] = useState(null);
  const [monthTick, setMonthTick] = useState(0); // para forzar "Reintentar"
  const [dayTick, setDayTick] = useState(0);

  const today = todayISO();
  const key = `${view.year}-${pad(view.month + 1)}`;
  const data = months[key];

  const loadMonth = useCallback(
    async (target) => {
      const k = `${target.year}-${pad(target.month + 1)}`;
      try {
        return await getMonthAvailability(service, target.year, target.month);
      } catch (err) {
        err.monthKey = k;
        throw err;
      }
    },
    [service]
  );

  // Carga el mes visible (y precarga el siguiente para saber si hay fechas próximas)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadingMonth(true);
      setMonthError(null);
      try {
        const current = await loadMonth(view);
        if (cancelled) return;
        setMonths((prev) => ({ ...prev, [key]: current }));
      } catch (err) {
        if (!cancelled) setMonthError(err.friendlyMessage || "No pudimos cargar la disponibilidad.");
      } finally {
        if (!cancelled) setLoadingMonth(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id, key, monthTick]);

  // HU-022 · ¿hay alguna fecha reservable en la ventana de reserva?
  useEffect(() => {
    if (!onNoDates) return;
    let cancelled = false;
    async function check() {
      try {
        const base = { year: now.getFullYear(), month: now.getMonth() };
        const next = shiftMonth(base, 1);
        const limit = addDays(todayISO(), MAX_NOTICE_DAYS);
        const targets = [base];
        if (`${next.year}-${pad(next.month + 1)}-01` <= limit) targets.push(next);
        const results = await Promise.all(targets.map(loadMonth));
        if (cancelled) return;
        const any = results.some((r) =>
          Object.values(r).some(
            (d) => d.status === DAY_STATUS.AVAILABLE || d.status === DAY_STATUS.PARTIAL
          )
        );
        onNoDates(!any);
      } catch {
        /* si falla, el error ya se muestra en el calendario */
      }
    }
    check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id]);

  // Horarios de la fecha elegida (consulta fresca al seleccionar)
  const selectedDate = value?.date || null;
  useEffect(() => {
    if (!selectedDate) {
      setDaySlots(null);
      return;
    }
    let cancelled = false;
    async function run() {
      setLoadingDay(true);
      setDayError(null);
      try {
        const res = await getDaySlots(service, selectedDate);
        if (!cancelled) setDaySlots(res);
      } catch (err) {
        if (!cancelled) {
          setDaySlots(null);
          setDayError(err.friendlyMessage || "No pudimos consultar los horarios.");
        }
      } finally {
        if (!cancelled) setLoadingDay(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [service, selectedDate, dayTick]);

  const cells = useMemo(() => {
    const first = `${view.year}-${pad(view.month + 1)}-01`;
    const offset = isoWeekday(first) - 1;
    const total = new Date(view.year, view.month + 1, 0).getDate();
    const list = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= total; d++) list.push(`${view.year}-${pad(view.month + 1)}-${pad(d)}`);
    return list;
  }, [view]);

  const canGoPrev = key > today.slice(0, 7);
  const nextView = shiftMonth(view, 1);
  const canGoNext = `${nextView.year}-${pad(nextView.month + 1)}-01` <= addDays(today, MAX_NOTICE_DAYS);

  function handleDayClick(iso, status) {
    if (status === DAY_STATUS.FULL || status === DAY_STATUS.DISABLED) return; // no selecciona
    onChange({ date: iso, startTime: null, endTime: null });
  }

  return (
    <div className="availability">
      <div className="calendar" aria-label="Calendario de disponibilidad">
        <div className="calendar__nav">
          <button
            type="button"
            className="btn btn--ghost calendar__arrow"
            onClick={() => setView(shiftMonth(view, -1))}
            disabled={!canGoPrev}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <strong className="calendar__title">
            {monthName(view.month)} {view.year}
          </strong>
          <button
            type="button"
            className="btn btn--ghost calendar__arrow"
            onClick={() => setView(nextView)}
            disabled={!canGoNext}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        <div className="calendar__grid calendar__grid--head">
          {WEEK_HEADER.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        {monthError ? (
          <div className="alert alert--error">
            {monthError}{" "}
            <button type="button" className="link-btn" onClick={() => setMonthTick((t) => t + 1)}>
              Reintentar
            </button>
          </div>
        ) : (
          <div className={`calendar__grid ${loadingMonth ? "calendar__grid--loading" : ""}`}>
            {cells.map((iso, i) => {
              if (!iso) return <span key={`b${i}`} />;
              const info = data?.[iso];
              const status = iso < today ? DAY_STATUS.DISABLED : info?.status || DAY_STATUS.DISABLED;
              const selected = iso === selectedDate;
              const blocked = status === DAY_STATUS.FULL || status === DAY_STATUS.DISABLED;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`day day--${status.toLowerCase()} ${selected ? "day--selected" : ""}`}
                  aria-disabled={blocked}
                  aria-pressed={selected}
                  title={STATUS_LABEL[status]}
                  onClick={() => handleDayClick(iso, status)}
                >
                  {Number(iso.slice(8))}
                </button>
              );
            })}
          </div>
        )}
        {loadingMonth && <p className="muted small center">Cargando disponibilidad…</p>}

        <ul className="legend">
          <li><i className="dot dot--available" /> Disponible</li>
          <li><i className="dot dot--partial" /> Parcialmente ocupado</li>
          <li><i className="dot dot--full" /> Agotado</li>
          <li><i className="dot dot--disabled" /> No habilitado</li>
        </ul>
      </div>

      <div className="slots">
        {!selectedDate && <p className="muted">Elige un día del calendario para ver los horarios.</p>}

        {selectedDate && (
          <>
            <h4 className="slots__title">Horarios para el {formatLongDate(selectedDate)}</h4>
            {loadingDay && <p className="muted">Consultando horarios…</p>}
            {dayError && (
              <div className="alert alert--error">
                {dayError}{" "}
                <button type="button" className="link-btn" onClick={() => setDayTick((t) => t + 1)}>
                  Reintentar
                </button>
              </div>
            )}
            {!loadingDay && daySlots?.reason === "NO_SERVICE" && (
              <p className="muted">El servicio no está disponible para esta fecha. Elige otro día.</p>
            )}
            {!loadingDay && daySlots?.reason === "EMPTY" && (
              <p className="muted">No hay horarios disponibles para la fecha seleccionada. Elige otro día.</p>
            )}
            {!loadingDay && daySlots?.slots.length > 0 && (
              <div className="slots__list">
                {daySlots.slots.map((s) => {
                  const active = value?.startTime === s.startTime;
                  return (
                    <button
                      key={s.startTime}
                      type="button"
                      className={`slot ${active ? "slot--active" : ""}`}
                      disabled={!selectableSlots}
                      aria-pressed={active}
                      onClick={() =>
                        onChange({ date: selectedDate, startTime: s.startTime, endTime: s.endTime })
                      }
                    >
                      {formatTime(s.startTime)}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
