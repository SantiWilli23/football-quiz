import { useState } from "react";
import api from "../api.js";
import Card from "./Card.jsx";
import { PROFILE_BANNERS } from "./Avatar.jsx";
import { badgeFor, teams } from "../carrera/data/teams.js";

const LEAGUE_LABELS = { premier: "Premier League", laliga: "LaLiga" };

// Frase, equipo del corazón y banner: lo que se ve en el encabezado del perfil.
export default function ProfileEditor({ user, onSaved }) {
  const initial = user?.profile || {};
  const [bio, setBio] = useState(initial.bio || "");
  const [favTeam, setFavTeam] = useState(initial.favTeam || "");
  const [banner, setBanner] = useState(initial.banner || "verde");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const leagues = [...new Set(teams.map((t) => t.league))];
  const touch = (fn) => (v) => { fn(v); setSaved(false); };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put("/auth/profile", { bio, favTeam, banner });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold mb-5">Personalizar perfil</h2>
      <div className="space-y-5">
        <div>
          <label htmlFor="bio" className="text-xs text-gray-500 mb-1.5 block">Frase ({bio.length}/80)</label>
          <input
            id="bio"
            value={bio}
            onChange={(e) => touch(setBio)(e.target.value.slice(0, 80))}
            placeholder="Ej: Hincha de toda la vida, pero de local nomás"
            className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="favTeam" className="text-xs text-gray-500 mb-1.5 block">Equipo del corazón</label>
          <div className="flex items-center gap-3">
            {favTeam && badgeFor(favTeam) ? (
              <img src={badgeFor(favTeam)} alt="" className="w-9 h-9 object-contain shrink-0" />
            ) : (
              <span className="w-9 h-9 rounded-full border border-dashed border-border shrink-0" />
            )}
            <select
              id="favTeam"
              value={favTeam}
              onChange={(e) => touch(setFavTeam)(e.target.value)}
              className="flex-1 min-w-0 bg-bg border border-border rounded-card px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Sin equipo</option>
              {leagues.map((lg) => (
                <optgroup key={lg} label={LEAGUE_LABELS[lg] || lg}>
                  {teams.filter((t) => t.league === lg).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Banner</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(PROFILE_BANNERS).map(([id, gradient]) => (
              <button
                key={id}
                type="button"
                onClick={() => touch(setBanner)(id)}
                aria-label={`Banner ${id}`}
                aria-pressed={banner === id}
                className={`w-12 h-8 rounded-card border border-black/30 transition-transform ${banner === id ? "scale-110 ring-2 ring-offset-2 ring-offset-panel ring-white/70" : ""}`}
                style={{ background: gradient }}
              />
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
      <button onClick={save} disabled={saving} className="btn btn-primary mt-6">
        {saving ? "Guardando..." : saved ? "Guardado" : "Guardar perfil"}
      </button>
    </Card>
  );
}
