import { useState } from "react";
import { Shuffle } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import {
  ACCESSORIES,
  AvatarSvg,
  BACKGROUNDS,
  DEFAULT_AVATAR,
  FACES,
  HAIRS,
  HAIR_COLORS,
  JERSEYS,
  JERSEY_COLORS,
  SKINS,
  parseAvatarConfig,
} from "./Avatar.jsx";

const HAIR_LABELS = {
  corto: "Corto",
  rulos: "Rulos",
  largo: "Largo",
  gorro: "Gorro",
  pelado: "Pelado",
  afro: "Afro",
  mohicano: "Mohicano",
  jopo: "Jopo",
  colita: "Colita",
  raya: "Con raya",
};

const FACE_LABELS = {
  sonrisa: "Sonrisa",
  seria: "Seria",
  grito: "Grito",
  picara: "Pícara",
  enojada: "Enojada",
  sorprendida: "Sorprendida",
  guino: "Guiño",
  triste: "Triste",
};

const ACCESSORY_LABELS = {
  ninguno: "Ninguno",
  anteojos: "Anteojos",
  vincha: "Vincha",
  barba: "Barba",
  bigote: "Bigote",
  gorra: "Gorra",
  pintura: "Pintura",
  sol: "De sol",
};

const JERSEY_LABELS = {
  lisa: "Lisa",
  rayas: "Rayada",
  banda: "Con banda",
  mitades: "Mitades",
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function ColorRow({ label, colors, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`${label}: ${color}`}
            aria-pressed={value === color}
            className={`w-7 h-7 rounded-full border-2 transition-transform ${
              value === color ? "border-white scale-110" : "border-black/30 hover:scale-105"
            }`}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}

function OptionRow({ label, options, labels, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
              value === option
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border text-gray-400 hover:text-white hover:border-white/30"
            }`}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AvatarEditor({ user, onSaved }) {
  const [config, setConfig] = useState(parseAvatarConfig(user?.avatar_config) ?? DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const randomize = () => {
    setConfig({
      bg: pick(BACKGROUNDS),
      skin: pick(SKINS),
      hair: pick(HAIRS),
      hairColor: pick(HAIR_COLORS),
      face: pick(FACES),
      accessory: pick(ACCESSORIES),
      jersey: pick(JERSEYS),
      jerseyColor: pick(JERSEY_COLORS),
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put("/auth/avatar", { config });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold mb-5">Mi avatar</h2>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* En escritorio el muñequito queda fijo a la vista mientras se
            recorren las opciones, que ahora son muchas. */}
        <div className="flex sm:flex-col items-center gap-3 shrink-0 sm:sticky sm:top-6 sm:self-start">
          <div className="rounded-full overflow-hidden">
            <AvatarSvg config={config} size={112} />
          </div>
          <button
            type="button"
            onClick={randomize}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <Shuffle size={13} />
            Al azar
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <ColorRow label="Fondo" colors={BACKGROUNDS} value={config.bg} onChange={set("bg")} />
          <ColorRow label="Piel" colors={SKINS} value={config.skin} onChange={set("skin")} />
          <OptionRow
            label="Pelo"
            options={HAIRS}
            labels={HAIR_LABELS}
            value={config.hair}
            onChange={set("hair")}
          />
          {config.hair !== "pelado" && (
            <ColorRow
              label="Color de pelo"
              colors={HAIR_COLORS}
              value={config.hairColor}
              onChange={set("hairColor")}
            />
          )}
          <OptionRow
            label="Cara"
            options={FACES}
            labels={FACE_LABELS}
            value={config.face}
            onChange={set("face")}
          />
          <OptionRow
            label="Accesorio"
            options={ACCESSORIES}
            labels={ACCESSORY_LABELS}
            value={config.accessory}
            onChange={set("accessory")}
          />
          <OptionRow
            label="Camiseta"
            options={JERSEYS}
            labels={JERSEY_LABELS}
            value={config.jersey}
            onChange={set("jersey")}
          />
          <ColorRow
            label="Color de camiseta"
            colors={JERSEY_COLORS}
            value={config.jerseyColor}
            onChange={set("jerseyColor")}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 bg-accent hover:bg-accent-dark disabled:opacity-50 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
      >
        {saving ? "Guardando..." : saved ? "Guardado" : "Guardar avatar"}
      </button>
    </Card>
  );
}
