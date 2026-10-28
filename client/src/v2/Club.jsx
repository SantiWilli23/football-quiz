import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Crown, Lock, Shield, Star } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useClubs } from "./useClubs.js";
import Copa from "./Copa.jsx";
import { Clasicos, Friendlies, Legends, LiveBanner, Recap, useLiveTable } from "./ClubExtras.jsx";
import Avatar from "../components/Avatar.jsx";
import Crest from "../components/Crest.jsx";
import ClubMiembro from "./ClubMiembro.jsx";
import ClubInsignias, { uniformColor } from "./ClubInsignias.jsx";
import CrearClub from "./CrearClub.jsx";

const VIEWS = [["hoy", "Hoy"], ["mes", "Mes"], ["general", "General"]];
const TABS = [["tabla", "Tabla"], ["copa", "Copa"], ["muro", "Muro"]];
const MODES = {
  clasico: { label: "Clásico", text: "Cuentan el partido del día y la copa." },
  total: { label: "Total", text: "Todo cuenta; el partido del día y la copa valen el doble. Las partidas libres suman con tope de 100 por día." },
};

export default function Club() {
  const { user } = useAuth();
  const { clubs, loaded, main, reload } = useClubs();
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("hoy");
  const [table, setTable] = useState(null);
  const [invite, setInvite] = useState("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => (["tabla", "copa", "muro"].includes(params.get("tab")) ? params.get("tab") : "tabla"));
  const [member, setMember] = useState(null);
  const [creating, setCreating] = useState(() => params.get("crear") === "1");
  const [joining, setJoining] = useState(false);

  const club = clubs.find((c) => c.id === selected) || main;
  const [live, setLive] = useState(null);

  const loadTable = () => {
    if (!club) return;
    setTable(null);
    api.get(`/clubs/${club.id}/table`, { params: { view } }).then((r) => setTable(r.data)).catch(() => setTable({ table: [], error: true }));
  };
  useEffect(loadTable, [club?.id, view, club?.started]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tabla en vivo: cuando alguien del club suma puntos se avisa y se recarga la tabla.
  useLiveTable(club?.started ? club.id : null, (e) => {
    setLive(e);
    loadTable();
    setTimeout(() => setLive((cur) => (cur === e ? null : cur)), 6000);
  });

  useEffect(() => {
    setInvite("");
    if (club) api.get(`/groups/${club.id}`).then((r) => setInvite(r.data.group?.invite_code || "")).catch(() => {});
  }, [club?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(fn, ok) {
    setMsg("");
    try { await fn(); setMsg(ok); await reload(); } catch (e) { setMsg(e.response?.data?.error || "No se pudo completar la acción."); }
  }

  const start = () => act(() => api.post(`/clubs/${club.id}/start`), "¡Temporada iniciada! Desde ahora suman los puntos.");
  const setMode = (mode) => act(() => api.post(`/clubs/${club.id}/mode`, { mode }), `Modo ${MODES[mode].label} activado.`);
  const makeMain = () => act(() => api.post("/clubs/main", { groupId: club.id }), "Es tu club principal.");
  const join = (e) => { e.preventDefault(); if (code.trim()) act(async () => { const r = await api.post("/groups/join", { invite_code: code.trim() }); setSelected(r.data.group.id); setCode(""); }, "¡Te uniste al club!"); };

  const tt = club?.mode === "total";
  // «Avisar»: un mensaje para mandarle por WhatsApp (o donde sea) a quien no jugó todavía.
  const nudge = (name) => {
    const text = `${name}, te falta el partido de hoy en Futotal. El club te espera ⚽ ${window.location.origin}/hoy`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => setMsg(`Mensaje para ${name} copiado.`), () => {});
  };
  const copyLink = () => { const url = `${window.location.origin}/invitacion/${invite}?de=${encodeURIComponent(user?.username || "")}`; navigator.clipboard?.writeText(url).then(() => setMsg("Link copiado: tu amigo verá tu marcador como desafío."), () => setMsg(url)); };

  return (
    <Layout hub>
      {loaded && !club && !creating && (
        <div className="p-sect p-stg p-narrow" style={{ "--i": 0, marginTop: 6 }}>
          <div className="p-card flex flex-col gap-3 items-center text-center" style={{ padding: 22 }}>
            <Shield size={44} style={{ color: "var(--acc)" }} />
            <h2 style={{ font: "800 22px var(--f-d)" }}>Juega con tus amigos</h2>
            <p className="p-muted text-sm">Crea un club o únete con un código.</p>
            <div className="p-btns w-full">
              <button className="p-btn" onClick={() => setCreating(true)}>Crear club</button>
              <button className="p-btn ghost" onClick={() => setJoining((j) => !j)}>Unirme</button>
            </div>
            {joining && <JoinForm code={code} setCode={setCode} join={join} />}
          </div>
        </div>
      )}

      {club && !creating && (
        <>
          <button className="p-chead p-stg" style={{ "--i": 0 }} onClick={() => clubs.length > 1 && setSelected(clubs[(clubs.findIndex((c) => c.id === club.id) + 1) % clubs.length].id)} aria-label={clubs.length > 1 ? "Cambiar de club" : club.name}>
            <Crest group={club} size={44} />
            <span className="flex-1 min-w-0">
              <h2 className="truncate">{club.name}</h2>
              <small>{club.members} {club.members === 1 ? "miembro" : "miembros"} · </small>
              <span className={`p-seal ${tt ? "t" : "c"}`}>{tt ? "TOTAL ×2" : "CLÁSICO"}</span>
              {club.main && <> <span className="p-seal c" style={{ color: "var(--gold)" }}>★ PRINCIPAL</span></>}
            </span>
            {clubs.length > 1 && <ChevronRight size={20} style={{ color: "var(--mute)" }} />}
          </button>
          <p className="p-stg mt-2.5 text-xs p-muted" style={{ "--i": 1 }}>{tt ? "Suman: partido del día ×2, copa ×2 y partidas libres (tope 100/día)." : "Suman: partido del día y copa semanal."}</p>

          <div className="p-dgrid mt-1">
          <div className="p-l">
          {!club.started ? (
            <div className="p-stg mt-3" style={{ "--i": 2 }}>
              <div className="p-card flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap"><span className="p-seal b">PRETEMPORADA</span><small className="p-muted">Aún no suman puntos</small></div>
                <p className="text-sm p-muted">Los puntos empiezan cuando se inicia la temporada. Así todos alcanzan a entrar.</p>
                <div className="p-row" style={{ justifyContent: "space-between" }}>
                  <span className="p-muted text-xs">Código</span>
                  <b className="p-mono select-all" style={{ color: "var(--gold)", fontSize: 18 }}>{invite || "…"}</b>
                  {invite && <button className="p-nudge" onClick={copyLink}>Copiar</button>}
                </div>
                {club.owner ? (
                  <>
                    <button className="p-btn big" onClick={start} disabled={club.members < 2}>Iniciar temporada</button>
                    <p className="text-xs p-dim text-center">{club.members < 2 ? "Hacen falta 2 miembros como mínimo." : `${club.members} miembros listos.`}</p>
                  </>
                ) : <p className="text-sm">El dueño iniciará la temporada.</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="p-seg p-stg mt-3" style={{ "--i": 2 }} role="tablist" aria-label="Secciones del club">
                {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>)}
              </div>

              {tab === "tabla" && (
                <div className="club-tab" key="tabla">
                  <LiveBanner event={live} />
                  <ClubStreakCard clubId={club.id} />
                  <div className="p-seg mt-3" style={{ maxWidth: 260 }} role="tablist" aria-label="Período de la tabla">
                    {VIEWS.map(([k, label]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{label}</button>)}
                  </div>
                  {club.members < 2 && <div className="p-card mt-3 text-center text-sm p-muted">Eres el único por ahora. Invita a tus amigos con el código <b style={{ color: "var(--fg)" }}>{invite}</b>.</div>}
                  <div className="p-rows mt-3">
                    {table === null && <p className="text-sm p-muted">Cargando…</p>}
                    {table?.error && <p className="text-sm" style={{ color: "var(--red)" }}>No se pudo cargar la tabla.</p>}
                    {table && !table.error && table.table.length === 0 && <div className="p-card text-sm p-muted text-center">Nadie sumó puntos todavía.</div>}
                    {(table?.table || []).map((r) => (
                      <button key={r.userId} onClick={() => setMember(r.userId)} className={`p-row ${r.userId === user?.id ? "me" : ""}`} aria-label={`Ver la ficha de ${r.username}`}>
                        <span className="pos">{view === "hoy" && table.playedToday && !table.playedToday.includes(r.userId) ? "–" : r.rank === 1 ? <Crown size={15} className="mx-auto" style={{ color: "var(--gold)" }} /> : r.rank}</span>
                        <Avatar user={{ id: r.userId, username: r.username, avatar: r.avatar, avatar_config: r.avatar_config }} size={34} uniform={uniformColor(club)} />
                        <span className="nm">{r.userId === user?.id ? "Tú" : r.username}</span>
                        {view === "hoy" && table.playedToday && !table.playedToday.includes(r.userId)
                          ? <><span className="p-pend">Pendiente</span>{r.userId !== user?.id && <span role="button" tabIndex={0} className="p-nudge" onClick={(e) => { e.stopPropagation(); nudge(r.username); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); nudge(r.username); } }}>Avisar</span>}</>
                          : <span className="pt">{r.points}</span>}
                      </button>
                    ))}
                  </div>
                  <p className="p-gap">{view === "hoy" ? "Solo cuenta el partido del día." : view === "mes" ? `Este mes · incluye partido, copa${tt ? " y partidas libres." : "."}` : "Todas las temporadas."}</p>
                  <div className="mt-4"><Friendlies clubId={club.id} /></div>
                </div>
              )}

              {tab === "copa" && <div className="club-tab mt-3" key="copa"><Copa clubId={club.id} userId={user?.id} /></div>}

              {tab === "muro" && (
                <div className="space-y-4 club-tab mt-3" key="muro">
                  <Recap clubId={club.id} />
                  <Legends clubId={club.id} />
                  <ClubInsignias club={{ ...club, invite }} />
                  <Clasicos clubId={club.id} />
                </div>
              )}
            </>
          )}

          </div>
          <div className="p-r">
          <section className="p-sect">
            <h3>Invitar</h3>
            <div className="p-card">
              <p className="text-sm p-muted">Pásales este código a tus amigos:</p>
              <p className="mt-1 select-all rounded-xl border border-dashed px-3 py-2 text-center p-mono" style={{ borderColor: "var(--line)", fontSize: 20, color: "var(--gold)" }}>{invite || "…"}</p>
              <div className="p-btns">
                {invite && <button onClick={copyLink} className="p-btn ghost sm">Copiar link con desafío</button>}
                {!club.main && <button onClick={makeMain} className="p-btn ghost sm">Hacer principal</button>}
              </div>
              {club.main && <p className="text-xs p-muted mt-3 flex items-center gap-1"><Star size={12} style={{ color: "var(--gold)" }} /> Es tu club principal: de aquí sale el súper sobre del podio del mes.</p>}
            </div>
          </section>

          {club.owner && (
            <section className="p-sect">
              <h3>Modo del club</h3>
              <div className="p-card">
                <p className="text-sm p-muted">{MODES[club.mode].text}</p>
                <div className="p-btns">
                  {Object.entries(MODES).filter(([k]) => k !== club.mode).map(([k, m]) => <button key={k} onClick={() => setMode(k)} className="p-btn ghost sm">Pasar a {m.label}</button>)}
                </div>
                {club.started && <p className="text-xs p-dim mt-2">El modo solo se cambia el día 1 de cada mes.</p>}
              </div>
            </section>
          )}

          <section className="p-sect">
            <div className="p-card" style={{ opacity: 0.8 }}>
              <p className="p-eyebrow" style={{ justifyContent: "flex-start" }}><Lock size={13} /> Liga de clubes · próximamente</p>
              <p className="mt-1 text-sm p-muted">Se abre cuando haya al menos 5 clubes con la temporada iniciada. Mientras tanto, desafía a otro club a un amistoso.</p>
            </div>
          </section>

          <section className="p-sect">
            <div className="p-btns">
              <button className="p-btn ghost sm" onClick={() => setCreating(true)}>Crear otro club</button>
              <button className="p-btn ghost sm" onClick={() => setJoining((j) => !j)}>Unirme a otro</button>
            </div>
            {joining && <div className="mt-3"><JoinForm code={code} setCode={setCode} join={join} /></div>}
          </section>
          </div>
          </div>
        </>
      )}

      {msg && <p className="text-sm text-center mt-3" style={{ color: "var(--acc2)" }} role="status">{msg}</p>}

      {loaded && creating && <CrearClub onDone={(id) => { setCreating(false); setSelected(id); setTab("tabla"); reload(); }} />}

      {member && club && <ClubMiembro club={{ ...club, invite }} uid={member} uniform={uniformColor(club)} onClose={() => setMember(null)} />}
    </Layout>
  );
}

function JoinForm({ code, setCode, join }) {
  return (
    <form onSubmit={join} className="flex gap-2 w-full">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CÓDIGO DEL CLUB" aria-label="Código del club" className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm uppercase p-mono" style={{ background: "var(--bg)", borderColor: "var(--line)" }} />
      <button className="p-btn sm">Unirme</button>
    </form>
  );
}

// Racha del club: si todos juegan el partido del día, el club gana un sobre extra.
function ClubStreakCard({ clubId }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/clubs/${clubId}/streak`).then((r) => setData(r.data)).catch(() => setData(null)); }, [clubId]);
  if (!data || data.members < 2) return null;
  return (
    <section className="p-sect">
      <h3>Racha del club<small style={{ color: "var(--gold)" }}>{data.streak} {data.streak === 1 ? "día" : "días"}</small></h3>
      <div className="p-card">
        <div className="p-cbar"><i style={{ width: `${Math.min(100, (data.playedToday || 0) / data.members * 100)}%` }} /></div>
        <p className="text-sm mt-2.5">{data.todayDone ? "Hoy jugaron todos: el club ganó un sobre extra." : <>Hoy jugaron <b>{data.playedToday || 0} de {data.members}</b>. Si juegan todos, el club gana un sobre extra.</>}</p>
      </div>
    </section>
  );
}
