import { useEffect, useState } from "react";
import { Check, Copy, FlaskConical, X } from "lucide-react";
import { useVersion } from "./version.js";
import { CAMBIOS } from "./cambios.js";
import "./changes/index.js";

const LABEL = { f1: "Futotal 1", actual: "Actual", demo: "Demo" };
const text = (c) => `Cambio #${c.n} · ${c.titulo}\n${c.texto}`;

// Barra del dueño: cambia entre Futotal 1, Actual y Demo; en la Demo muestra cuántos cambios hay y
// los lista con su número y su explicación para copiarlos y pasarlos a la versión actual.
export default function DemoBar() {
  const { owner, version, setVersion, tema, setTema } = useVersion();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const on = owner && version === "demo";
    document.documentElement.toggleAttribute("data-demo", on);
    if (on && tema !== "base") document.documentElement.setAttribute("data-tema", tema); else document.documentElement.removeAttribute("data-tema");
  }, [owner, version, tema]);
  if (!owner) return null;

  const demo = version === "demo";
  const copy = async (what, list) => {
    const out = list.map(text).join("\n\n");
    try { await navigator.clipboard.writeText(out); } catch {
      const t = document.createElement("textarea"); t.value = out; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch { /* sin portapapeles */ } t.remove();
    }
    setCopied(what); setTimeout(() => setCopied(""), 1500);
  };
  const toggle = (n) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const chosen = CAMBIOS.filter((c) => sel.has(c.n));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Versiones y cambios de la Demo"
        className="fixed z-[70] right-3 bottom-[84px] lg:bottom-4 flex items-center gap-1.5 rounded-full border border-accent/60 bg-panel px-3 py-2 text-xs font-semibold shadow-lg">
        <FlaskConical size={14} className="text-accent" /> {LABEL[version]}{demo && ` · ${CAMBIOS.length} ${CAMBIOS.length === 1 ? "cambio" : "cambios"}`}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Versiones" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-2xl border border-border bg-panel p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Versión de la app</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="p-1"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2" role="tablist">
              {Object.entries(LABEL).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={version === k} onClick={() => setVersion(k)}
                  className={`rounded-xl border px-2 py-2.5 text-sm ${version === k ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{l}</button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {version === "f1" && "Futotal 1: la app de antes, sin el rediseño. Solo lo ves tú."}
              {version === "actual" && "Actual: lo que ve todo el mundo hoy."}
              {demo && "Demo: pruebas los cambios aquí. Copia los que te gusten y pásamelos para ponerlos en Actual."}
            </p>
            {demo && (
              <section aria-label="Diseño" className="space-y-2">
                <h3 className="font-semibold">Diseño</h3>
                <div className="grid grid-cols-3 gap-2" role="tablist">
                  {[["base", "Base", "Paleta ampliada"], ["a", "A", "Noche de estadio"], ["b", "B", "Álbum de figuritas"]].map(([k, l, s]) => (
                    <button key={k} type="button" role="tab" aria-selected={tema === k} onClick={() => setTema(k)}
                      className={`rounded-xl border px-2 py-2 text-left ${tema === k ? "border-accent bg-accent/10" : "border-border text-gray-400"}`}>
                      <b className="block text-sm">{l}</b><span className="block text-[11px] leading-tight">{s}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {demo && (
              <section aria-label="Cambios de la Demo" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{CAMBIOS.length} {CAMBIOS.length === 1 ? "cambio" : "cambios"}</h3>
                  <div className="flex gap-2">
                    <button type="button" disabled={!chosen.length} onClick={() => copy("sel", chosen)} className="rounded-lg border border-border px-2.5 py-1 text-xs disabled:opacity-40">
                      {copied === "sel" ? "Copiado" : `Copiar elegidos (${chosen.length})`}
                    </button>
                    <button type="button" onClick={() => copy("all", CAMBIOS)} className="rounded-lg border border-accent/60 bg-accent/10 px-2.5 py-1 text-xs font-semibold">
                      {copied === "all" ? "Copiado" : "Copiar todos"}
                    </button>
                  </div>
                </div>
                <ul className="space-y-2">
                  {CAMBIOS.map((c) => (
                    <li key={c.n} className="flex gap-2 rounded-xl border border-border p-2.5">
                      <button type="button" onClick={() => toggle(c.n)} aria-pressed={sel.has(c.n)} aria-label={`Elegir cambio ${c.n}`}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center ${sel.has(c.n) ? "border-accent bg-accent text-black" : "border-border"}`}>
                        {sel.has(c.n) && <Check size={13} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold"><span className="tabular-nums text-accent">#{c.n}</span> {c.titulo}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{c.texto}</p>
                      </div>
                      <button type="button" onClick={() => copy(c.n, [c])} aria-label={`Copiar cambio ${c.n}`} className="shrink-0 self-start p-1 text-gray-400 hover:text-white">
                        {copied === c.n ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </li>
                  ))}
                  {CAMBIOS.length === 0 && <li className="text-sm text-gray-500">Todavía no hay cambios en la Demo.</li>}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
