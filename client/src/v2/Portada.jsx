import { Link } from "react-router-dom";
import { Play } from "lucide-react";

// Portada (Futotal 2.0): sin explicaciones, un solo botón. Se juega un partido de práctica
// antes de registrarse; recién al terminar se pide la cuenta.
export default function Portada() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12 text-center text-white">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-card bg-gradient-to-br from-accent-light to-emerald-500 text-xl font-extrabold text-onaccent">FT</div>
        <div>
          <h1 className="bg-gradient-to-r from-accent-light via-accent to-emerald-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">FUTOTAL</h1>
          <p className="mt-3 text-lg font-semibold">El partido del día. Con tu club.</p>
          <p className="mt-1 text-sm text-gray-400">Un partido igual para todos. Tres partes, un minuto cada una.</p>
        </div>
        <Link to="/practica" className="btn btn-primary w-full inline-flex items-center justify-center gap-2 text-base">
          <Play size={18} /> Jugar ahora
        </Link>
        <p className="text-xs text-gray-500">Sin registro. Sin tutorial largo. Aprendés jugando.</p>
        <div className="flex gap-4 text-sm text-gray-400">
          <Link to="/login" className="hover:text-white">Ya tengo cuenta</Link>
          <Link to="/registro" className="hover:text-white">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
