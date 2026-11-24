/** Minutos sin actividad antes de cerrar la sesión del proveedor. */
export const INACTIVITY_MS = 5 * 60 * 1000;
const EVENTS = ["click", "keydown", "scroll", "touchstart"];

/**
 * Llama onTimeout si no hay clics, teclas ni scroll durante timeoutMs.
 * Cada actividad reinicia la cuenta. También se revisa al volver a la pestaña,
 * porque el navegador congela los temporizadores cuando el equipo duerme.
 * Devuelve una función para detenerlo.
 */
export function watchInactivity(onTimeout, { timeoutMs = INACTIVITY_MS, target = window, doc = document } = {}) {
  let last = Date.now();
  let timer = null;
  let done = false;

  const fire = () => {
    if (done) return;
    done = true;
    stop();
    onTimeout();
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(fire, timeoutMs);
  };
  const touch = () => {
    last = Date.now();
    arm();
  };
  const check = () => {
    if (doc.visibilityState === "hidden") return;
    if (Date.now() - last >= timeoutMs) fire();
  };
  function stop() {
    clearTimeout(timer);
    EVENTS.forEach((e) => target.removeEventListener(e, touch, true));
    doc.removeEventListener("visibilitychange", check);
  }

  EVENTS.forEach((e) => target.addEventListener(e, touch, { capture: true, passive: true }));
  doc.addEventListener("visibilitychange", check);
  arm();
  return stop;
}
