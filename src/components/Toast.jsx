import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Avisos flotantes que se van solos. useToast() -> { success, error, info }.
 * Los errores que el usuario debe corregir siguen mostrándose dentro de la página.
 */
const ToastContext = createContext({ success() {}, error() {}, info() {} });
const LIFETIME = { success: 4500, info: 4500, error: 7000 };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((l) => l.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, text) => {
    if (!text) return;
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { id, type, text }]);
    timers.current.set(id, setTimeout(() => dismiss(id), LIFETIME[type]));
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const api = useMemo(() => ({
    success: (t) => push("success", t),
    error: (t) => push("error", t),
    info: (t) => push("info", t),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role={t.type === "error" ? "alert" : "status"}>
            <span className="toast__icon" aria-hidden="true">{t.type === "success" ? "✓" : t.type === "error" ? "!" : "i"}</span>
            <span className="toast__text">{t.text}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
