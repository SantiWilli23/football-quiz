import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-bg text-white">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-panel border-r border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-card bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold">
            FQ
          </div>
          <span className="font-semibold text-xl tracking-tight">Football Quiz</span>
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
        <p className="text-xs text-gray-600">Football Quiz © {new Date().getFullYear()}</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-1">Crear cuenta</h2>
          <p className="text-gray-400 text-sm mb-8">Empezá a jugar en un minuto</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="tu_usuario"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-dark disabled:opacity-50 transition-colors text-black font-semibold rounded-card py-2.5 text-sm"
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
