import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import FloatField from "../components/FloatField.jsx";
import Avatar from "../components/Avatar.jsx";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // La cuenta ya está creada en cuanto esto es true: se muestra la
  // presentación de refuerzo en vez de mandar directo al panel, como el
  // video corto de fichaje de un club antes del primer entrenamiento.
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (!revealing) return;
    const t = setTimeout(() => navigate("/"), 2400);
    return () => clearTimeout(t);
  }, [revealing, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !email.trim() || !password) {
      setError("Completá todos los campos");
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
      await register(username.trim(), email.trim(), password);
      setRevealing(true);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  if (revealing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-white px-6">
        <div className="celebrate-pop text-center max-w-xs">
          <p className="t-eyebrow mb-6">Nuevo refuerzo</p>
          <Avatar user={user} size={96} className="mx-auto mb-5" />
          <h1 className="text-2xl font-bold mb-1">{user?.username}</h1>
          <p className="text-sm text-gray-400 mb-8">Ya es parte del plantel de Futotal.</p>
          <button onClick={() => navigate("/")} className="btn btn-primary inline-flex items-center gap-1">
            Entrar <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg text-white">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-panel border-r border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-card bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold">
            FT
          </div>
          <span className="font-semibold text-xl tracking-tight">Futotal</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Sumate a la
            <br />
            competencia.
          </h1>
          <p className="text-gray-400 max-w-md">
            Creá tu cuenta, uníte a un grupo con tus amigos y empezá a sumar puntos
            respondiendo la pregunta del día.
          </p>
        </div>
        <p className="text-xs text-gray-600">Futotal © {new Date().getFullYear()}</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-1">Crear cuenta</h2>
          <p className="text-gray-400 text-sm mb-8">Empezá a jugar en un minuto</p>

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
            ¿Ya tenés cuenta?{" "}
            <Link to="/login" className="text-accent hover:text-accent-light font-medium">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
