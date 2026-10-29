import { useEffect } from "react";
import { useVersion } from "./version.js";

// Sin interfaz propia: solo marca <html data-demo data-tema> cuando el dueño está en la beta. El
// panel de versiones vive en Perfil › Ajustes (demo/CodigoAjuste.jsx).
export default function DemoBar() {
  const { version, tema } = useVersion();
  useEffect(() => {
    // data-demo: los cambios aprobados (todos menos Futotal 1). data-beta: colores y temas por aprobar.
    document.documentElement.toggleAttribute("data-demo", version !== "f1");
    const beta = version === "demo";
    document.documentElement.toggleAttribute("data-beta", beta);
    if (beta && tema !== "base") document.documentElement.setAttribute("data-tema", tema); else document.documentElement.removeAttribute("data-tema");
  }, [version, tema]);
  return null;
}
