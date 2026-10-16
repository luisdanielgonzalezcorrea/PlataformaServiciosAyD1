// Las pruebas de integración corren en Node (axios usa http, sin CORS de navegador).
// Los servicios del front usan localStorage/sessionStorage, así que los simulamos en memoria.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}
globalThis.localStorage = memoryStorage();
globalThis.sessionStorage = memoryStorage();
