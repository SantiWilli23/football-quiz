import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

// Página pública (sin login) para un link de invitación — antes solo se
// podía unir tipeando el código a mano adentro del grupo ya logueado. Acá se
// ve un preview del grupo antes de registrarse, para que el link se pueda
// mandar por WhatsApp con contexto real en vez de "confiá y registrate".
export default function InvitePreview() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api
      .get(`/groups/invite/${code}/preview`)
      .then(({ data }) => setPreview(data))
      .catch(() => setError("Este link de invitación no es válido o ya venció."));
  }, [code]);

  async function joinNow() {
    setJoining(true);
    try {
      await api.post("/groups/join", { invite_code: code });
      navigate("/grupo");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo unir al grupo");
      setJoining(false);
    }
  }

  function goRegister() {
    localStorage.setItem("fq_pending_invite", code);
    navigate("/registro");
  }

  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-panel border border-border rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-4">
          <Users size={22} className="text-accent" />
        </div>

        {!preview && !error && <p className="text-sm text-gray-500">Cargando invitación...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {preview && (
          <>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Te invitaron a</p>
            <h1 className="text-xl font-bold mb-1">{preview.name}</h1>
            {preview.description && <p className="text-sm text-gray-400 mb-3">{preview.description}</p>}
            <p className="text-xs text-gray-500 mb-6">{preview.member_count} miembro{preview.member_count === 1 ? "" : "s"}</p>

            <p className="text-xs text-gray-500 mb-5">
              Trivia diaria, duelos 1v1, estadísticas del grupo y mucho más — competí con ellos en Futotal.
            </p>

            {!loading && user && (
              <button
                onClick={joinNow}
                disabled={joining}
                className="btn btn-primary w-full"
              >
                {joining ? "Uniéndote..." : `Unirme como ${user.username}`}
              </button>
            )}
            {!loading && !user && (
              <button
                onClick={goRegister}
                className="btn btn-primary w-full"
              >
                Crear cuenta y unirme
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
