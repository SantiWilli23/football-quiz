import { useState } from "react";
import { PenLine, Plus, Trash2 } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import { CHALK } from "../theme.js";

const COLOR = CHALK.yellow;
const MAX_OPTIONS = 4;

// Se muestra cuando todavía nadie del grupo escribió la pregunta del día.
// El primero que la manda se la queda: el backend rechaza la segunda.
export default function GroupQuestionComposer({ groupId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setOption = (index, value) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));

  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (index) => setOptions((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/mode-b/group-question", { group_id: groupId, prompt, options });
      setPrompt("");
      setOptions(["", ""]);
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la pregunta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ borderLeft: `4px solid ${COLOR}`, background: `${COLOR}0d`, borderRadius: "8px" }}>
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5"
            style={{ background: `${COLOR}26`, color: COLOR, borderColor: `${COLOR}66` }}
          >
            <PenLine size={12} />
            Pregunta del grupo
          </span>
        </div>

        {!open ? (
          <>
            <h2 className="text-lg font-semibold mb-1">Todavía nadie escribió la pregunta de hoy</h2>
            <p className="text-sm text-gray-400 mb-5">
              Sé el primero: escribí una pregunta con alternativas y el resto del grupo la responde.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="px-4 py-2.5 rounded-card text-sm font-semibold text-black transition-opacity hover:opacity-90"
              style={{ background: COLOR }}
            >
              Escribir la pregunta de hoy
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium mb-2">Tu pregunta</label>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={200}
              placeholder="¿Quién del grupo la tiene más clara con el fútbol?"
              className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm mb-1 focus:outline-none focus:border-white/40"
            />
            <p className="text-[11px] text-gray-600 mb-4">{prompt.length}/200</p>

            <label className="block text-sm font-medium mb-2">Alternativas</label>
            <div className="space-y-2 mb-3">
              {options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold"
                    style={{ borderColor: `${COLOR}66`, color: COLOR }}
                  >
                    {["A", "B", "C", "D"][i]}
                  </span>
                  <input
                    value={option}
                    onChange={(e) => setOption(i, e.target.value)}
                    maxLength={100}
                    placeholder={`Alternativa ${["A", "B", "C", "D"][i]}`}
                    className="flex-1 min-w-0 bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-white/40"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      aria-label={`Quitar alternativa ${["A", "B", "C", "D"][i]}`}
                      className="p-2 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={addOption}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 mb-4 transition-colors"
              >
                <Plus size={13} />
                Agregar alternativa
              </button>
            )}

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-card text-sm font-semibold text-black disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: COLOR }}
              >
                {saving ? "Publicando..." : "Publicar para el grupo"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <span className="text-[11px] text-gray-600 w-full sm:w-auto">
                Una vez publicada no se puede editar.
              </span>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
