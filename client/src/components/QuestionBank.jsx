import { useCallback, useEffect, useState } from "react";
import { Check, PenLine, Plus, Trash2 } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";

const COLOR = "#f59e0b";
const LETTERS = ["A", "B", "C", "D"];

export default function QuestionBank({ groupId }) {
  const [questions, setQuestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data } = await api.get("/mode-b/bank", { params: { groupId } });
      setQuestions(data.questions);
    } catch {
      setQuestions([]);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/mode-b/bank", { group_id: groupId, prompt, options });
      setPrompt("");
      setOptions(["", ""]);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la pregunta");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/mode-b/bank/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo borrar");
    }
  };

  const pending = questions.filter((q) => !q.used_on);
  const used = questions.filter((q) => q.used_on);

  if (!groupId) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <PenLine size={16} style={{ color: COLOR }} />
        <h2 className="font-semibold">Banco de preguntas del grupo</h2>
      </div>
      <p className="text-sm text-gray-400 mb-5">
        Dejá preguntas cargadas y van saliendo solas en el modo especial. Tienen prioridad sobre las
        que trae la app: sólo se usa una del banco si ese día nadie escribió una en vivo.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-card text-sm font-semibold text-black transition-opacity hover:opacity-90 mb-5"
          style={{ background: COLOR }}
        >
          <Plus size={15} />
          Agregar una pregunta
        </button>
      ) : (
        <form onSubmit={submit} className="mb-6">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={200}
            placeholder="¿Quién del grupo desaparece cuando hay que organizar algo?"
            className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm mb-1 focus:outline-none focus:border-white/40"
          />
          <p className="text-[11px] text-gray-600 mb-3">{prompt.length}/200</p>

          <div className="space-y-2 mb-3">
            {options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold"
                  style={{ borderColor: `${COLOR}66`, color: COLOR }}
                >
                  {LETTERS[i]}
                </span>
                <input
                  value={option}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
                  }
                  maxLength={100}
                  placeholder={`Alternativa ${LETTERS[i]}`}
                  className="flex-1 min-w-0 bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-white/40"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Quitar alternativa ${LETTERS[i]}`}
                    className="p-2 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 4 && (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 mb-4 transition-colors"
            >
              <Plus size={13} />
              Agregar alternativa
            </button>
          )}

          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-card text-sm font-semibold text-black disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: COLOR }}
            >
              {saving ? "Guardando..." : "Guardar en el banco"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-gray-500">El banco está vacío.</p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-2">
            En espera ({pending.length}) · salen en el orden en que se cargaron
          </p>
          <div className="space-y-2 mb-4">
            {pending.length === 0 && (
              <p className="text-sm text-gray-600">No queda ninguna esperando.</p>
            )}
            {pending.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-3 px-4 py-3 rounded-card border border-border bg-bg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm mb-1">{q.prompt}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {q.options.join(" · ")} — de {q.mine ? "vos" : q.author}
                  </p>
                </div>
                {q.mine && (
                  <button
                    onClick={() => remove(q.id)}
                    aria-label="Borrar del banco"
                    className="p-1.5 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {used.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-2">Ya salieron ({used.length})</p>
              <div className="space-y-1.5">
                {used.slice(0, 5).map((q) => (
                  <div key={q.id} className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="shrink-0" />
                    <span className="truncate">{q.prompt}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}
