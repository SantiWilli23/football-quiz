import { Navigate } from "react-router-dom";

// El pase de temporada ahora vive en el Perfil; esta ruta queda para los links viejos.
export default function PaseTemporada() {
  return <Navigate to="/perfil" replace />;
}
