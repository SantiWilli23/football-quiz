import { useState } from "react";
import api from "../api.js";
import Card from "../components/Card.jsx";

// Yo › Ajustes: ver de nuevo el código de recuperación de la cuenta.
export default function RecoveryCode() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function show() {
    setError("");
    try { setCode((await api.get("/auth/recovery-code")).data.recoveryCode); } catch { setError("No se pudo cargar el código."); }
  }

  return (
    <Card className="mb-6">
      <h2 className="font-semibold mb-1">Código de recuperación</h2>
      <p className="text-sm text-gray-400 mb-3">Si olvidas la contraseña, es lo único que te devuelve la cuenta. No lo compartas.</p>
      {code
        ? <p className="select-all rounded-xl border border-dashed border-border bg-bg px-3 py-2 text-center font-mono tracking-widest">{code}</p>
        : <button onClick={show} className="btn btn-secondary btn-sm">Mostrar mi código</button>}
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </Card>
  );
}
