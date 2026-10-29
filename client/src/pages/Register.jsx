import { useState } from "react";
import BrandPanel from "../v2/BrandPanel.jsx";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import useFutotal2 from "../v2/useFutotal2.js";
import FloatField from "../components/FloatField.jsx";
import Avatar from "../components/Avatar.jsx";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const { on: v2 } = useFutotal2();
  const practica = new URLSearchParams(window.location.search).get("practica");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // La cuenta ya está creada en cuanto esto es true: se muestra la
  // presentación de refuerzo en vez de mandar directo al panel, como el
  // video corto de fichaje de un club antes del primer entrenamiento.
  const [revealing, setRevealing] = useState(false);
  // Código de recuperación: se muestra una vez y se queda en pantalla hasta que la
  // persona lo guarde (es la única forma de recuperar la cuenta, no hay email).
  const [recoveryCode, setRecoveryCode] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try { await navigator.clipboard.writeText(recoveryCode); setCopied(true); } catch { /* sin portapapeles */ }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !email.trim() || !password) {
      setError("Completa todos los campos");
      return;
    }
    if (username.trim().length < 3) {
      setError("El usuario debe tener al menos 3 caracteres");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const data = await register(username.trim(), email.trim(), password);
      setRecoveryCode(data?.recoveryCode || "");
      setRevealing(true);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  // Ya había una sesión (no se está creando una cuenta ahora): directo a la app.
  if (user && !loading && !revealing) return <Navigate to={v2 ? "/hoy" : "/"} replace />;

  if (revealing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-white px-6">
        <div className="celebrate-pop text-center max-w-xs">
          <p className="t-eyebrow mb-6">Nuevo refuerzo</p>
          <Avatar user={user} size={96} className="mx-auto mb-5" />
          <h1 className="text-2xl font-bold mb-1">{user?.username}</h1>
          <p className="text-sm text-gray-400 mb-6">Ya es parte del plantel de Futotal.</p>
          {recoveryCode && (
            <div className="mb-6 rounded-2xl border border-border bg-panel p-4 text-left">
              <p className="t-eyebrow mb-1">Tu código de recuperación</p>
              <p className="select-all rounded-xl border border-dashed border-border bg-bg px-3 py-2 text-center font-mono text-base tracking-widest">{recoveryCode}</p>
              <p className="text-xs text-gray-400 mt-2">Guárdalo: es la única forma de recuperar tu cuenta si olvidas la contraseña. Lo puedes volver a ver en Perfil › Ajustes.</p>
              <button type="button" onClick={copyCode} className="btn btn-secondary btn-sm mt-2 w-full">{copied ? "Copiado" : "Copiar código"}</button>
            </div>
          )}
          <button onClick={() => navigate(v2 ? "/bienvenida" : "/")} className="btn btn-primary inline-flex items-center gap-1">
            Entrar <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg text-white">
      {v2 ? <BrandPanel /> : (
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-panel border-r border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-card bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold">
            FT
          </div>
          <span className="font-semibold text-xl tracking-tight">Futotal</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Súmate a la
            <br />
            competencia.
          </h1>
          <p className="text-gray-400 max-w-md">
            Crea tu cuenta, únete a un grupo con tus amigos y empieza a sumar puntos
            respondiendo la pregunta del día.
          </p>
        </div>
        <p className="text-xs text-gray-600">Futotal © {new Date().getFullYear()}</p>
      </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-1">Crear cuenta</h2>
          <p className="text-gray-400 text-sm mb-8">Empieza a jugar en un minuto</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatField label="Usuario" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
            <FloatField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FloatField label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p className="text-sm text-gray-400 mt-6 text-center">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-accent hover:text-accent-light font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
