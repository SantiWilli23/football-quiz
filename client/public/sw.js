// Service worker: recibe notificaciones push y deja abrir la app sin señal (Futotal 2.0).
// El caché es «primero la red»: con conexión siempre se sirve lo último, y solo si la red
// falla se usa la copia guardada. Nunca guarda la API (/api) ni los sockets (/ws).
const SHELL_CACHE = "futotal-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws")) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => {
            cache.put(req, copy.clone());
            // La app es de una sola página: cualquier ruta cargada sirve de respaldo de «/».
            if (req.mode === "navigate") cache.put("/", copy);
          });
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/") : Response.error())))
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Futotal", body: "Tenés preguntas nuevas.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Si el cuerpo no es JSON válido se muestra el aviso genérico.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url },
      tag: "football-quiz-diario",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  // Si la app ya está abierta en alguna pestaña se enfoca esa en vez de abrir
  // otra copia.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
