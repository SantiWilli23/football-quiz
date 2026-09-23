import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import FloatField from "../components/FloatField.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Completá todos los campos");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-bg text-white">
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center gap-10 p-12 bg-panel border-r border-border text-center relative overflow-hidden">
        <svg aria-hidden="true" className="absolute inset-0 w-full h-full text-white opacity-[0.06] pointer-events-none" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="30" y="30" width="340" height="540" rx="4" />
          <line x1="30" y1="300" x2="370" y2="300" />
          <circle cx="200" cy="300" r="60" />
          <rect x="110" y="30" width="180" height="90" />
          <rect x="110" y="480" width="180" height="90" />
        </svg>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-card bg-gradient-to-br from-accent-light to-emerald-500 flex items-center justify-center text-onaccent font-extrabold text-xl">
            FT
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-accent-light via-accent to-emerald-500 bg-clip-text text-transparent">
            FUTOTAL
          </h1>
          <p className="text-gray-400 max-w-sm text-sm">
            La trivia de fútbol que desafía a los que lo saben todo
          </p>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="w-16 h-px bg-border" />
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Trivia diaria
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Duelos
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Grupos
            </span>
          </div>
          <Link
            to="/registro"
            className="rounded-full bg-gradient-to-r from-accent to-accent-light px-8 py-3 text-sm font-semibold text-onaccent hover:opacity-90 transition-opacity"
          >
            Jugar ahora
          </Link>
        </div>

        <p className="text-xs text-gray-600 tracking-wide">COTRERO · DRAFT EUROPEO 8A2 · TRIVIA</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-1">Iniciar sesión</h2>
          <p className="text-gray-400 text-sm mb-8">Ingresá a tu cuenta para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FloatField label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <p className="text-sm text-gray-400 mt-6 text-center">
            ¿No tenés cuenta?{" "}
            <Link to="/registro" className="text-accent hover:text-accent-light font-medium">
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
