import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";

const SUPPORTED =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

// La clave VAPID viaja en base64url y PushManager la quiere como bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// iOS sólo permite notificaciones si la web está agregada a la pantalla de
// inicio; conviene decirlo antes de que el permiso falle sin explicación.
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

export default function PushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!SUPPORTED) return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => setEnabled(false));
  }, []);

  const enable = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("No diste permiso para las notificaciones.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const { data } = await api.get("/push/public-key");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      await api.post("/push/subscribe", { subscription: subscription.toJSON() });
      setEnabled(true);
      setNote("Listo. Te avisamos si al final del día te quedaron preguntas sin responder.");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudieron activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api.post("/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch {
      setError("No se pudieron desactivar.");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await api.post("/push/test");
      setNote("Notificación de prueba enviada.");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo enviar la prueba.");
    } finally {
      setBusy(false);
    }
  };

  if (!SUPPORTED) {
    return (
      <Card>
        <h2 className="font-semibold mb-2">Recordatorio diario</h2>
        <p className="text-sm text-gray-500">
          Este navegador no soporta notificaciones push.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        {enabled ? (
          <Bell size={17} className="text-accent" />
        ) : (
          <BellOff size={17} className="text-gray-500" />
        )}
        <h2 className="font-semibold">Recordatorio diario</h2>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        {enabled
          ? "Están activadas en este dispositivo."
          : "Un aviso al final del día si te quedaron preguntas sin responder."}
      </p>

      {isIos && !isStandalone && !enabled && (
        <p className="text-xs text-amber-400/90 mb-4">
          En iPhone hay que agregar la app a la pantalla de inicio (Compartir → Agregar a inicio)
          antes de poder activarlas: es un requisito de Apple, no de la app.
        </p>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {note && <p className="text-sm text-accent mb-3">{note}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        {enabled ? (
          <>
            <button
              onClick={disable}
              disabled={busy}
              className="px-4 py-2 rounded-card text-sm font-medium border border-border text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-50 transition-colors"
            >
              Desactivar
            </button>
            <button
              onClick={sendTest}
              disabled={busy}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
              Probar
            </button>
          </>
        ) : (
          <button
            onClick={enable}
            disabled={busy}
            className="bg-accent hover:bg-accent-dark disabled:opacity-50 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
          >
            {busy ? "Activando..." : "Activar notificaciones"}
          </button>
        )}
      </div>
    </Card>
  );
}
