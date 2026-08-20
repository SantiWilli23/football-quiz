import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

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
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-panel border-r border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-card bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold">
            FQ
          </div>
          <span className="font-semibold text-xl tracking-tight">Football Quiz</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Una pregunta de fútbol.
            <br />
            Todos los días.
          </h1>
          <p className="text-gray-400 max-w-md">
            Compite con tus amigos, mantené tu racha y demostrá quién sabe más de fútbol
            en tu grupo.
          </p>
        </div>
        <p className="text-xs text-gray-600">Football Quiz © {new Date().getFullYear()}</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-1">Iniciar sesión</h2>
          <p className="text-gray-400 text-sm mb-8">Ingresá a tu cuenta para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-dark disabled:opacity-50 transition-colors text-black font-semibold rounded-card py-2.5 text-sm"
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
