// Service worker mínimo: sólo existe para poder recibir notificaciones push.
// No cachea nada — la app se sigue sirviendo normalmente desde la red.

self.addEventListener("push", (event) => {
  let payload = { title: "Football Quiz", body: "Tenés preguntas nuevas.", url: "/" };
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
