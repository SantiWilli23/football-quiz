import { useEffect, useState } from "react";
import { applyDevice, setDeviceMode, shouldFrameAsPhone } from "../utils/device.js";

// Si alguien en una computadora elige el modo teléfono, la app se muestra dentro de un marco del
// tamaño de un teléfono (la misma página en un iframe). Ahí adentro la pantalla mide de verdad
// ~400 px, así que todo el diseño se comporta como en un teléfono. Al cambiar el modo desde
// Configuración (adentro del marco) este componente se entera por el evento "storage".
export default function DeviceShell({ children }) {
  const [framed, setFramed] = useState(shouldFrameAsPhone);

  useEffect(() => {
    const update = () => { applyDevice(); setFramed(shouldFrameAsPhone()); };
    window.addEventListener("storage", update);
    window.addEventListener("resize", update);
    window.addEventListener("fq:device", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("fq:device", update);
    };
  }, []);

  if (!framed) return children;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 py-4" style={{ background: "#0b0e11" }}>
      <div
        style={{ width: 400, height: "min(860px, 90vh)", borderRadius: 36, border: "10px solid #23272d", boxShadow: "0 20px 60px rgba(0,0,0,.6)", overflow: "hidden", background: "#000" }}
      >
        <iframe src={window.location.href} title="Futotal en modo teléfono" style={{ width: "100%", height: "100%", border: 0 }} />
      </div>
      <button
        onClick={() => setDeviceMode("computador")}
        style={{ color: "#9aa3ad", fontSize: 13, textDecoration: "underline", background: "none", border: 0, cursor: "pointer" }}
      >
        Volver al modo computador
      </button>
    </div>
  );
}
