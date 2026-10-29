import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import Card from "../components/Card.jsx";
import { lockAgain, unlockWithCode, useVersion } from "./version.js";
import { CAMBIOS } from "./cambios.js";
import "./changes/index.js";

const text = (c) => `Cambio #${c.n} · ${c.titulo}\n${c.texto}`;
const VERS = [
  ["f1", "Anterior", "Futotal 1, sin el rediseño"],
  ["actual", "Actual", "Lo que ve todo el mundo"],
  ["demo", "Beta", "Cambios por probar"],
];

// «Código» en Ajustes: con el código correcto aparece debajo el apartado de versiones (anterior,
// actual y beta con su número de cambios) y, en la beta, la lista de cambios para copiarlos.
export default function CodigoAjuste() {
  const { owner, version, setVersion } = useVersion();
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [copied, setCopied] = useState("");

  const submit = (e) => { e.preventDefault(); const ok = unlockWithCode(code); setBad(!ok); if (ok) setCode(""); };
  const copy = async (what, list) => {
    const out = list.map(text).join("\n\n");
    try { await navigator.clipboard.writeText(out); } catch {
      const t = document.createElement("textarea"); t.value = out; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch { /* sin portapapeles */ } t.remove();
    }
    setCopied(what); setTimeout(() => setCopied(""), 1500);
  };
  const toggle = (n) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const chosen = CAMBIOS.filter((c) => sel.has(c.n));
  const n = CAMBIOS.length;

  return (
    <>
      <Card className="mb-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2"><KeyRound size={16} /> Código</h2>
        {!owner ? (
          <form onSubmit={submit} className="mt-2 flex gap-2">
            <input value={code} onChange={(e) => { setCode(e.target.value); setBad(false); }} inputMode="numeric" autoComplete="off" placeholder="Escribe el código" aria-label="Código"
              className="min-w-0 flex-1 rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            <button type="submit" className="btn btn-secondary btn-sm">Aplicar</button>
          </form>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-400">Código aceptado: abajo están las versiones.</p>
            <button type="button" onClick={lockAgain} className="btn btn-secondary btn-sm shrink-0">Quitar</button>
          </div>
        )}
        {bad && <p role="alert" className="mt-2 text-sm text-red-400">Ese código no es válido.</p>}
      </Card>

      {owner && (
        <Card className="mb-6">
          <h2 className="font-semibold mb-3">Versiones</h2>
          <div className="grid grid-cols-3 gap-2" role="tablist">
            {VERS.map(([k, l, s]) => (
              <button key={k} type="button" role="tab" aria-selected={version === k} onClick={() => setVersion(k)}
                className={`rounded-xl border px-2 py-2.5 text-left ${version === k ? "border-accent bg-accent/10" : "border-border text-gray-400"}`}>
                <b className="block text-sm">{l}</b>
                <span className="block text-[11px] leading-tight">{k === "demo" ? `${n} ${n === 1 ? "cambio" : "cambios"}` : s}</span>
              </button>
            ))}
          </div>
          {version === "demo" && (
            <div className="mt-4 space-y-4">
              <section aria-label="Cambios de la beta" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{n} {n === 1 ? "cambio" : "cambios"}</h3>
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
                </ul>
              </section>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
