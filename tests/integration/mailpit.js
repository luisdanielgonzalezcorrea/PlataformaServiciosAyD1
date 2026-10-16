// Lee los correos que el back manda a Mailpit (en desarrollo no salen a ningún buzón real).
const MAILPIT = process.env.MAILPIT_URL || "http://localhost:8025";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function mailpitDisponible() {
  try {
    const res = await fetch(`${MAILPIT}/api/v1/info`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Espera el correo más reciente para `to` cuyo asunto contenga `subject` y devuelve el código de 6 dígitos. */
export async function leerCodigo(to, subject, { intentos = 20 } = {}) {
  for (let i = 0; i < intentos; i++) {
    const q = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${q}&limit=1`);
    const lista = await res.json();
    const msg = lista.messages?.[0];
    if (msg) {
      const detalle = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      const texto = detalle.Text || "";
      const m = texto.match(/c[oó]digo[^0-9]*(\d{6})/i) || texto.match(/\b(\d{6})\b/);
      if (m) return m[1];
    }
    await sleep(500);
  }
  throw new Error(`No llegó a Mailpit un correo para ${to} con asunto "${subject}".`);
}
