import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getMyCompany } from "../api/companyService";
import { getServiceById, getServicesByCompany, updateServiceRange } from "../api/catalogService";
import { loadSchedule, saveSchedule } from "../api/scheduleService";
import { WEEK_DAYS, formatTime, minutesToTime, timeToMinutes } from "../utils/dates";
import { validateDateRange } from "../utils/validation";

/**
 * HU-013 · Creación de agenda (rango de vigencia del servicio)
 * HU-014 · Definición de días y horarios de atención
 */
export default function AgendaPage() {
  const [params, setParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noCompany, setNoCompany] = useState(false);

  const selectedId = params.get("servicio");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const company = await getMyCompany().catch((err) => {
        if (err.status === 404) return null;
        throw err;
      });
      if (!company) {
        setNoCompany(true);
        return;
      }
      const { data } = await getServicesByCompany(company.data.id);
      setServices(data);
    } catch (err) {
      setError(err.friendlyMessage || "No pudimos cargar tus servicios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (!selectedId) {
      setService(null);
      return;
    }
    getServiceById(selectedId)
      .then((res) => setService(res.data))
      .catch((err) => setError(err.friendlyMessage));
  }, [selectedId]);

  if (loading) return <p className="center muted">Cargando tus servicios…</p>;

  if (noCompany) {
    return (
      <div className="card center">
        <p>Primero registra tu negocio para poder crear servicios y agendas.</p>
        <Link className="btn btn--primary" to="/negocio">Registrar mi negocio</Link>
      </div>
    );
  }

  return (
    <div className="narrow">
      <h1>Mi agenda</h1>
      <p className="muted">Define cuándo está disponible cada servicio y en qué horarios atiendes.</p>

      {error && (
        <div className="alert alert--error">
          {error} <button className="link-btn" onClick={loadServices}>Reintentar</button>
        </div>
      )}

      {services.length === 0 && !error ? (
        <div className="card center">
          <p>Aún no tienes servicios. Crea el primero y vuelve acá.</p>
          <Link className="btn btn--primary" to="/negocio">Crear servicio</Link>
        </div>
      ) : (
        <label className="field">
          <span>Servicio</span>
          <select value={selectedId || ""} onChange={(e) => setParams(e.target.value ? { servicio: e.target.value } : {})}>
            <option value="">Selecciona un servicio…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      )}

      {service && (
        <>
          <RangeCard key={`r-${service.id}`} service={service} onSaved={setService} />
          <ScheduleCard key={`s-${service.id}`} service={service} />
          <p className="small">
            <Link to={`/servicio/${service.id}`}>Ver cómo lo ve el cliente →</Link>
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------------------- HU-013 · vigencia --------------------------- */

function RangeCard({ service, onSaved }) {
  const [startDate, setStartDate] = useState(service.startDate || "");
  const [endDate, setEndDate] = useState(service.endDate || "");
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setOk(null);
    const rangeError = validateDateRange(startDate, endDate);
    if (rangeError) {
      setError(rangeError);
      return; // no se guarda
    }
    // El back trata null como "no cambiar", así que una fecha ya definida no se puede quitar.
    if ((service.startDate && !startDate) || (service.endDate && !endDate)) {
      setError("Una fecha de vigencia ya guardada no se puede dejar vacía; cámbiala por otra.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { data } = await updateServiceRange(service.id, { startDate, endDate });
      onSaved(data);
      setOk("Guardamos la vigencia del servicio.");
    } catch (err) {
      setError(err.friendlyMessage || "No se pudo guardar la vigencia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSave} noValidate>
      <h2>Vigencia del servicio</h2>
      <p className="muted small">
        El servicio solo se puede reservar dentro de este rango. Si dejas las fechas vacías, no tiene límite.
      </p>
      {error && <div className="alert alert--error">{error}</div>}
      {ok && <div className="alert alert--success">{ok}</div>}
      <div className="form-grid">
        <label className="field">
          <span>Fecha de inicio</span>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setError(null); }} />
        </label>
        <label className="field">
          <span>Fecha de fin</span>
          <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => { setEndDate(e.target.value); setError(null); }} />
        </label>
      </div>
      <button className="btn btn--primary" disabled={saving}>
        {saving ? "Guardando…" : "Guardar vigencia"}
      </button>
    </form>
  );
}

/* ------------------------- HU-014 · días y horarios ----------------------- */

function emptyDays() {
  return Object.fromEntries(WEEK_DAYS.map((d) => [d.value, []]));
}

function daysFrom(items) {
  const base = emptyDays();
  (items || []).forEach((s) => base[s.dayOfWeek]?.push({ start: String(s.startTime).slice(0, 5), end: String(s.endTime).slice(0, 5) }));
  return base;
}

function validateDays(days) {
  const errors = {};
  let any = false;
  for (const [day, ranges] of Object.entries(days)) {
    if (ranges.length === 0) continue;
    any = true;
    const list = [];
    ranges.forEach((r, i) => {
      if (!r.start || !r.end) {
        list.push(`Franja ${i + 1}: completa la hora de inicio y de fin.`);
      } else if (timeToMinutes(r.end) <= timeToMinutes(r.start)) {
        list.push(`Franja ${i + 1}: la hora de fin debe ser posterior a la hora de inicio.`);
      }
    });
    if (list.length === 0) {
      const sorted = [...ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
      for (let i = 1; i < sorted.length; i++) {
        if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) {
          list.push("Hay franjas que se solapan. Ajusta los horarios.");
          break;
        }
      }
    }
    if (list.length) errors[day] = list;
  }
  return { errors, any };
}

function ScheduleCard({ service }) {
  const [days, setDays] = useState(emptyDays);
  const [source, setSource] = useState("none");
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSchedule(service.id, service)
      .then(({ items, source: from }) => {
        if (!alive) return;
        setDays(daysFrom(items));
        setSource(from);
      })
      .catch(() => {})
      .finally(() => alive && setLoadingSaved(false));
    return () => {
      alive = false;
    };
  }, [service.id]);

  const spaces = useMemo(() => {
    let total = 0;
    Object.values(days).forEach((ranges) =>
      ranges.forEach((r) => {
        if (r.start && r.end && timeToMinutes(r.end) > timeToMinutes(r.start)) {
          total += Math.floor((timeToMinutes(r.end) - timeToMinutes(r.start)) / service.durationMinutes);
        }
      })
    );
    return total;
  }, [days, service.durationMinutes]);

  function toggleDay(day, enabled) {
    setDays((prev) => ({
      ...prev,
      [day]: enabled ? [{ start: "08:00", end: "12:00" }] : [],
    }));
    setErrors((p) => ({ ...p, [day]: undefined }));
    setBanner(null);
  }

  function updateRange(day, index, field, value) {
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));
    setErrors((p) => ({ ...p, [day]: undefined }));
    setBanner(null);
  }

  function addRange(day) {
    setDays((prev) => {
      const last = prev[day][prev[day].length - 1];
      const start = last?.end || "14:00";
      const end = minutesToTime(Math.min(timeToMinutes(start) + 180, 23 * 60 + 59));
      return { ...prev, [day]: [...prev[day], { start, end }] };
    });
  }

  function removeRange(day, index) {
    setDays((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    const { errors: found, any } = validateDays(days);
    setErrors(found);
    if (!any) {
      setBanner({ type: "error", text: "Selecciona al menos un día de atención." });
      return;
    }
    if (Object.keys(found).length > 0) {
      setBanner({ type: "error", text: "Corrige los horarios marcados para poder guardar." });
      return; // HU-014.3 y .4: no se guarda
    }
    const items = [];
    Object.entries(days).forEach(([day, ranges]) =>
      ranges.forEach((r) => items.push({ day_of_week: Number(day), start_time: r.start, end_time: r.end }))
    );
    setSaving(true);
    setBanner(null);
    try {
      await saveSchedule(service.id, items);
      setSource("local");
      setBanner({ type: "success", text: `Agenda guardada. Se generan ${spaces} espacios de ${service.durationMinutes} min.` });
    } catch (err) {
      setBanner({ type: "error", text: err.friendlyMessage || "No se pudo guardar la agenda." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>Días y horarios de atención</h2>
      <p className="muted small">
        Marca los días en que atiendes y define las franjas. Los espacios se generan cada{" "}
        <strong>{service.durationMinutes} min</strong>. Los días sin marcar quedan como “No habilitado”
        para el cliente. Al guardar se reemplaza toda la agenda del servicio.
      </p>
      {banner && <div className={`alert alert--${banner.type === "error" ? "error" : "success"}`}>{banner.text}</div>}
      {!loadingSaved && source === "none" && (
        <div className="alert alert--info">
          Este servicio todavía no tiene días de atención definidos en este navegador. Mientras no guardes
          una agenda, los clientes verán “sin espacios disponibles”.
        </div>
      )}
      {source === "inferred" && (
        <div className="alert alert--info">
          Reconstruimos tus días y horarios a partir de lo que hoy ven los clientes. Revisa que estén completos
          y guarda la agenda para dejarla confirmada.
        </div>
      )}
      {source === "local" && (
        <div className="alert alert--info">
          Mostramos la última agenda que guardaste desde este navegador. Si la cambiaste desde otro equipo, vuelve a guardarla.
        </div>
      )}

      <ul className="days">
        {WEEK_DAYS.map((d) => {
          const ranges = days[d.value];
          const enabled = ranges.length > 0;
          return (
            <li key={d.value} className={`days__row ${enabled ? "is-on" : ""}`}>
              <label className="check days__toggle">
                <input type="checkbox" checked={enabled} onChange={(e) => toggleDay(d.value, e.target.checked)} />
                <span>{d.label}</span>
              </label>

              {!enabled ? (
                <span className="muted small">No habilitado</span>
              ) : (
                <div className="days__ranges">
                  {ranges.map((r, i) => (
                    <div key={i} className="range">
                      <input type="time" value={r.start} onChange={(e) => updateRange(d.value, i, "start", e.target.value)} aria-label={`Inicio ${d.label}`} />
                      <span>a</span>
                      <input type="time" value={r.end} onChange={(e) => updateRange(d.value, i, "end", e.target.value)} aria-label={`Fin ${d.label}`} />
                      <span className="muted small range__hint">
                        {r.start && r.end ? `${formatTime(r.start)} – ${formatTime(r.end)}` : ""}
                      </span>
                      {ranges.length > 1 && (
                        <button type="button" className="link-btn" onClick={() => removeRange(d.value, i)}>Quitar</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="link-btn" onClick={() => addRange(d.value)}>+ Agregar franja</button>
                  {errors[d.value]?.map((m) => (
                    <span key={m} className="field__error">{m}</span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="actions actions--between">
        <span className="muted small">Espacios por semana: <strong>{spaces}</strong></span>
        <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar agenda"}
        </button>
      </div>
    </section>
  );
}
