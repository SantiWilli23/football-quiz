import { useEffect } from "react";
import { useVersion } from "./version.js";

// Sin interfaz propia: solo marca <html data-demo data-tema> cuando el dueño está en la beta. El
// panel de versiones vive en Perfil › Ajustes (demo/CodigoAjuste.jsx).
export default function DemoBar() {
  const { owner, version, tema } = useVersion();
  useEffect(() => {
    const on = owner && version === "demo";
    document.documentElement.toggleAttribute("data-demo", on);
    if (on && tema !== "base") document.documentElement.setAttribute("data-tema", tema); else document.documentElement.removeAttribute("data-tema");
  }, [owner, version, tema]);
  return null;
}
