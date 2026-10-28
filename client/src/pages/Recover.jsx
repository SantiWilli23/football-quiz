import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api.js";
import FloatField from "../components/FloatField.jsx";

// Recuperar la cuenta con el código que se mostró al registrarse (no hay email).
export default function Recover() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !code.trim() || password.length < 6) {
      setError("Completa todo. La contraseña nueva necesita al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/recover", { username: username.trim(), code: code.trim(), newPassword: password });
      localStorage.setItem("fq_token", data.token);
      setFresh(data.recoveryCode);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo recuperar la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  if (fresh) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-white px-6">
        <div className="max-w-sm w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold">¡Cuenta recuperada!</h1>
          <p className="text-sm text-gray-400">Cambiamos tu contraseña y generamos un código nuevo. El anterior ya no sirve. Guárdalo:</p>
          <p className="select-all rounded-xl border border-dashed border-border bg-panel px-3 py-3 font-mono tracking-widest">{fresh}</p>
          <button className="btn btn-primary w-full" onClick={() => { window.location.assign("/"); }}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-white px-6">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Recuperar mi cuenta</h1>
          <p className="text-sm text-gray-400 mt-1">Usa el código FUT-XXXX-XXXX-XXXX que te mostramos al registrarte.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <FloatField label="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <FloatField label="Código de recuperación" value={code} onChange={(e) => setCode(e.target.value)} />
          <FloatField label="Contraseña nueva" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? "Recuperando..." : "Recuperar"}</button>
        </form>
        <p className="text-sm text-gray-400 text-center"><Link to="/login" className="text-accent">Volver a ingresar</Link></p>
      </div>
    </div>
  );
}
