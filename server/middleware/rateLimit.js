// Límite simple en memoria, por IP, para frenar fuerza bruta y spam en rutas
// sensibles (login, adivinar en ¿Quién es?, predicciones del mercado). No usa
// una librería aparte a propósito: un solo proceso de Render, sin Redis, así
// que un Map alcanza. Si el servicio algún día corre en varias instancias
// esto hay que moverlo a un store compartido.
const buckets = new Map();

// Limpieza periódica para no acumular IPs viejas en memoria para siempre.
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < 15 * 60 * 1000);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}, 5 * 60 * 1000).unref();

// rateLimit({ windowMs: 60_000, max: 10 }) -> middleware que responde 429
// "Demasiados intentos, esperá un momento" si una misma IP supera `max`
// pedidos a esta ruta dentro de `windowMs`.
export function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.baseUrl}${req.path}:${req.ip}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      return res.status(429).json({ error: message || "Demasiados intentos, esperá un momento" });
    }
    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}
