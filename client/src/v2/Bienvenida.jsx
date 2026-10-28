import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gift, Heart } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import { Picker } from "../components/FavClubCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Primer ingreso, después del registro: tu club de fútbol favorito → sobre de bienvenida
// (con una carta segura de ese club) → crear un club de amigos o unirte con un código.
export default function Bienvenida() {
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const [fav, setFav] = useState(user?.profile?.favClub || null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function choose(club) {
    setPicking(false);
    setBusy(true);
    setError("");
    try {
      await api.put("/auth/fav-club", club);
      await api.post("/me/welcome", { club: club.name });
      await refreshMe();
      setFav(club);
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo guardar tu club. Prueba de nuevo.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-white">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <p className="t-eyebrow">Bienvenido, {user?.username}</p>
          <h1 className="t-title">Armemos tu equipo</h1>
        </div>

        {!fav ? (
          <Card variant="feature">
            <p className="flex items-center gap-2 font-semibold"><Heart size={16} className="text-red-400" /> ¿De qué club eres hincha?</p>
            <p className="mt-1 text-sm text-gray-400">Te regalamos un sobre con una carta segura de ese club.</p>
            <button onClick={() => setPicking(true)} disabled={busy} className="btn btn-primary mt-4 w-full">Elegir mi club</button>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </Card>
        ) : (
          <>
            <Card variant="feature">
              <p className="flex items-center gap-2 font-semibold"><Gift size={16} className="text-accent" /> Tu sobre de bienvenida está listo</p>
              <p className="mt-1 text-sm text-gray-400">Trae una carta segura de <b>{fav.name}</b>. Se abre en Cartas.</p>
              <Link to="/cartas" className="btn btn-primary mt-4 w-full">Abrir mi sobre</Link>
            </Card>
            <Card>
              <p className="font-semibold">Ahora, tu club de amigos</p>
              <p className="mt-1 text-sm text-gray-400">Crea un club o únete con un código. Sin club, los puntos no cuentan.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => navigate("/club")} className="btn btn-secondary">Crear o unirme</button>
                <button onClick={() => navigate("/hoy")} className="btn btn-secondary">Más tarde</button>
              </div>
            </Card>
          </>
        )}
        {picking && <Picker onPick={choose} onClose={() => setPicking(false)} />}
      </div>
    </div>
  );
}
