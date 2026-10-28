import { useCallback, useEffect, useState } from "react";
import { Crown, Handshake, Radio, ScrollText } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Tabla en vivo: el servidor avisa (SSE) cuando alguien del club suma puntos, y se muestra
// «Juan acaba de sacar 82» sin recargar. EventSource no manda encabezados, así que el token va
// en la URL. Si la conexión se cae, el navegador reintenta solo.
export function useLiveTable(groupId, onPoints) {
  useEffect(() => {
    if (!groupId || typeof EventSource === "undefined") return undefined;
    let token = "";
    try { token = localStorage.getItem("fq_token") || ""; } catch { /* sin storage */ }
    if (!token) return undefined;
    const es = new EventSource(`/api/club-stream/${groupId}?token=${encodeURIComponent(token)}`);
    es.addEventListener("points", (e) => { try { onPoints(JSON.parse(e.data)); } catch { /* evento mal formado */ } });
    return () => es.close();
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function LiveBanner({ event }) {
  if (!event) return null;
  const label = event.source === "partido_dia" ? `sacó ${event.points}` : event.source === "copa" ? `ganó ${event.points} en la copa` : `sumó ${event.points}`;
  return (
    <p className="celebrate-pop flex items-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm" role="status">
      <Radio size={14} className="shrink-0 text-accent animate-pulse" /> <b>{event.username}</b> acaba de sumar: {label}.
    </p>
  );
}

// Resumen del lunes
export function Recap({ clubId }) {
  const [r, setR] = useState(null);
  useEffect(() => { api.get(`/clubs/${clubId}/recap`).then((x) => setR(x.data)).catch(() => setR(null)); }, [clubId]);
  if (!r || (!r.top.length && !r.champion)) return null;
  return (
    <Card>
      <p className="t-eyebrow flex items-center gap-1.5"><ScrollText size={13} /> Resumen de la semana pasada</p>
      <ol className="mt-2 divide-y divide-border">
        {r.top.map((t, i) => (
          <li key={t.userId} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-5 text-center font-bold text-gray-400">{i === 0 ? <Crown size={14} className="mx-auto text-amber" /> : i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{t.username}</span><b className="tabular-nums">{t.points}</b>
          </li>
        ))}
      </ol>
      {r.me && r.me.change !== null && r.me.change !== 0 && <p className="mt-2 text-sm text-gray-300">Terminaste {r.me.rank}° ({r.me.change > 0 ? `subiste ${r.me.change}` : `bajaste ${Math.abs(r.me.change)}`} {Math.abs(r.me.change) === 1 ? "puesto" : "puestos"} respecto de la semana anterior).</p>}
      {r.champion && <p className="mt-1 text-sm text-gray-400">Campeón de la copa: <b className="text-white">{r.champion.username}</b>.</p>}
    </Card>
  );
}

// Amistoso entre clubes
export function Friendlies({ clubId }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [code, setCode] = useState("");
  const load = useCallback(() => api.get(`/clubs/${clubId}/friendlies`).then((r) => setData(r.data)).catch(() => setData(false)), [clubId]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  async function challenge(e) {
    e.preventDefault();
    try { await api.post(`/clubs/${clubId}/friendly`, { code }); toast("Desafío enviado"); setCode(""); load(); } catch (err) { toast(err.response?.data?.error || "No se pudo desafiar"); }
  }
  async function act(id, action) {
    try { await api.post(`/clubs/friendlies/${id}/${action}`); load(); } catch (err) { toast(err.response?.data?.error || "No se pudo completar"); }
  }
  const mine = (f) => (f.mine === "a" ? f.a : f.b);
  const other = (f) => (f.mine === "a" ? f.b : f.a);

  return (
    <Card>
      <p className="t-eyebrow flex items-center gap-1.5"><Handshake size={13} /> Amistoso entre clubes</p>
      <p className="mt-1 text-sm text-gray-400">Una semana, el partido del día contra otro club. Gana la mejor media. No suma puntos a la tabla.</p>
      <ul className="mt-2 divide-y divide-border">
        {data.friendlies.map((f) => (
          <li key={f.id} className="py-2.5 text-sm">
            <p><b>{mine(f).name}</b> <span className="text-gray-500">vs</span> <b>{other(f).name}</b> <span className="text-gray-500">· semana del {f.week}</span></p>
            {f.status === "pending" && (
              <p className="mt-1 text-xs text-gray-400">
                {f.mine === "b" && data.owner
                  ? <span className="flex gap-2"><button onClick={() => act(f.id, "accept")} className="btn btn-primary btn-sm">Aceptar</button><button onClick={() => act(f.id, "decline")} className="btn btn-secondary btn-sm">Rechazar</button></span>
                  : "Esperando que el otro club acepte."}
              </p>
            )}
            {f.status === "accepted" && (
              <>
                <div className="mt-1 grid grid-cols-2 gap-2 text-center">
                  <span className="rounded-xl border border-border px-2 py-1.5"><span className="block text-lg font-bold tabular-nums">{mine(f).avg ?? "–"}</span><span className="text-[11px] text-gray-500">{mine(f).name}</span></span>
                  <span className="rounded-xl border border-border px-2 py-1.5"><span className="block text-lg font-bold tabular-nums">{other(f).avg ?? "–"}</span><span className="text-[11px] text-gray-500">{other(f).name}</span></span>
                </div>
                {f.daysLeft != null && <p className="mt-1 text-xs text-gray-500">Quedan {f.daysLeft} {f.daysLeft === 1 ? "día" : "días"}.</p>}
              </>
            )}
            {f.status === "closed" && <p className="mt-1 text-xs text-gray-400">{f.winner ? (f.winner === mine(f).id ? "¡Ganó tu club! Todos recibieron la insignia «Amistoso ganado»." : `Ganó ${other(f).name}.`) : "Empate."} ({mine(f).avg ?? "–"} a {other(f).avg ?? "–"})</p>}
          </li>
        ))}
        {data.friendlies.length === 0 && <li className="py-2 text-sm text-gray-500">Todavía no hay amistosos.</li>}
      </ul>
      {data.owner && (
        <form onSubmit={challenge} className="mt-2 flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código del otro club" className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm uppercase" />
          <button className="btn btn-secondary btn-sm" disabled={!code.trim()}>Desafiar</button>
        </form>
      )}
    </Card>
  );
}

// Leyendas del club: las mejores carreras de Cotrero de los miembros.
export function Legends({ clubId }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.get(`/clubs/${clubId}/legends`).then((r) => setList(r.data.legends)).catch(() => setList([])); }, [clubId]);
  if (list === null) return null;
  return (
    <Card>
      <p className="t-eyebrow flex items-center gap-1.5"><Crown size={13} /> Leyendas del club</p>
      {list.length === 0 ? (
        <p className="mt-1 text-sm text-gray-400">Termina una carrera de Cotrero medio para entrar al salón.</p>
      ) : (
        <ol className="mt-2 divide-y divide-border">
          {list.map((l) => (
            <li key={l.place} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 text-center font-bold text-gray-400">{l.place}</span>
              <span className="min-w-0 flex-1"><b className="block truncate">{l.name || l.username}</b><span className="text-xs text-gray-500">{[l.label, l.pos, l.name ? `de ${l.username}` : null, l.verified === false ? "sin verificar" : null].filter(Boolean).join(" · ")}</span></span>
              <b className="tabular-nums">{l.score}</b>
            </li>
          ))}
        </ol>
      )}
      <a href="/cotrero-medio.html" className="mt-2 inline-block text-xs text-accent">{list.length ? "Probá superarlos en Cotrero medio" : "Ir a Cotrero medio"}</a>
    </Card>
  );
}

// Historial de clásicos del club: qué hinchada ganó en cada partido temático.
export function Clasicos({ clubId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/events/history", { params: { groupId: clubId } }).then((r) => setRows(r.data.history)).catch(() => setRows([])); }, [clubId]);
  if (!rows || rows.length === 0) return null;
  return (
    <Card>
      <p className="t-eyebrow">Historial de clásicos</p>
      <ul className="mt-2 divide-y divide-border">
        {rows.map((r) => (
          <li key={r.event.date} className="py-2.5 text-sm">
            <p className="font-semibold">{r.event.teams.home.name} <span className="text-gray-500">vs</span> {r.event.teams.away.name}</p>
            <p className="text-xs text-gray-400">
              {r.event.date} · {r.home.fans} vs {r.away.fans} hinchas ·{" "}
              {r.winner ? <>ganó la hinchada de <b className="text-white">{r.event.teams[r.winner].name}</b></> : "empate"}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
