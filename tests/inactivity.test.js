import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INACTIVITY_MS, watchInactivity } from "../src/utils/inactivity";

describe("Cierre por inactividad (3 minutos)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("cierra la sesión a los 3 minutos sin actividad", () => {
    const out = vi.fn();
    watchInactivity(out);
    vi.advanceTimersByTime(INACTIVITY_MS - 1000);
    expect(out).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(out).toHaveBeenCalledTimes(1);
  });

  it.each(["click", "keydown", "scroll"])("la actividad (%s) reinicia el contador", (evt) => {
    const out = vi.fn();
    watchInactivity(out);
    vi.advanceTimersByTime(INACTIVITY_MS - 1000);
    window.dispatchEvent(new Event(evt));
    vi.advanceTimersByTime(INACTIVITY_MS - 1000);
    expect(out).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(out).toHaveBeenCalledTimes(1);
  });

  it("al detenerlo ya no cierra la sesión", () => {
    const out = vi.fn();
    const stop = watchInactivity(out);
    stop();
    vi.advanceTimersByTime(INACTIVITY_MS * 2);
    expect(out).not.toHaveBeenCalled();
  });
});
