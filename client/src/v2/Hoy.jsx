import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronRight, Flame, Share2, Shield, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Avatar from "../components/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useClubs } from "./useClubs.js";
import { useStreak } from "./Shell.jsx";
import { track } from "./analytics.js";
import { pendingMatch, syncQueue } from "./offline.js";
import EventCards from "./Evento.jsx";
import Ceremonia from "./Ceremonia.jsx";
import { TorneoBanner } from "./Album.jsx";
import { useDemo } from "../demo/version.js";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Segundos que faltan para la medianoche de Chile (el día del partido cambia a las 00:00 de Santiago).
function secondsToMidnight() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return 86400 - (get("hour") * 3600 + get("minute") * 60 + get("second"));
}
const hms = (s) => [s / 3600 | 0, (s % 3600) / 60 | 0, s % 60].map((x) => String(x).padStart(2, "0")).join(":");

function Countdown() {
  const [s, setS] = useState(secondsToMidnight);
  useEffect(() => { const t = setInterval(() => setS(secondsToMidnight()), 1000); return () => clearInterval(t); }, []);
  return <span className="p-mono">Cierra en {hms(s)}</span>;
}

// Número del partido: días desde el primero (1 de enero de 2026).
const matchNumber = (date) => (date ? Math.round((Date.parse(date) - Date.parse("2026-01-01")) / 86400000) + 1 : null);

function Hero({ today, streak, mult }) {
  const demo = useDemo();
  const navigate = useNavigate();
  const played = today && today.result;
  const inProgress = today && !today.result && today.answered?.length > 0;
  const parts = played ? today.result.parts : null;
  const cell = (lab, sub, i) => (
    <div className="p-cell">
      <span className="lab">{lab}</span>
      <b className={`num ${parts ? "" : "empty"}`}>{parts ? parts[i] * mult : "–"}</b>
      <small>{sub}</small>
    </div>
  );
  const week = streak?.week || [];
  const wd = streak?.weekday ?? -1;
  const share = () => {
    const text = `Futotal · partido nº ${matchNumber(today.date)}: ${today.result.total} puntos (${parts.join(" · ")}). ¿Me superas?`;
    if (navigator.share) navigator.share({ text, url: window.location.origin }).catch(() => {});
    else navigator.clipboard?.writeText(`${text} ${window.location.origin}`).catch(() => {});
  };
  return (
    <section className="p-hero p-stg" style={{ "--i": 0 }}>
      <div className="p-eyebrow">
        <span>Partido del día{today?.date ? ` · nº ${matchNumber(today.date)}` : ""}</span>
        <Countdown />
      </div>
      <div className="p-board">
        {cell("1T", "¿Quién es?", 0)}
        {cell("2T", "Más o menos", 1)}
        {cell("PEN", "Penales", 2)}
      </div>
      {today === null && <p className="text-center text-sm p-muted">Cargando…</p>}
      {today === false && <p className="text-center text-sm" style={{ color: "var(--red)" }}>No se pudo cargar el partido de hoy.</p>}
      {played && (
        <>
          <div className="p-total"><b>{today.result.total * mult}</b><span>PUNTOS{mult > 1 && <> <em className="p-x2">×2</em></>}</span></div>
          <div className="p-btns">
            <button className="p-btn ghost" onClick={share}><Share2 size={18} />Compartir</button>
            <Link className="p-btn ghost" to="/club">Ver tabla</Link>
          </div>
        </>
      )}
      {today && !played && (
        <>
          <button className="p-btn big p-pulse" onClick={() => { track("partido_click_hoy"); navigate("/partido"); }}>
            {inProgress ? "SEGUIR JUGANDO" : "JUGAR"}
          </button>
          {demo ? (mult > 1 && <p className="mt-2.5 text-center"><span className="p-x2">×2 en tu club</span></p>) : <p className="text-center text-xs p-muted mt-2.5">3 minijuegos · unos 3 minutos{mult > 1 ? " · vale doble en tu club" : ""}</p>}
        </>
      )}
      <div className="p-week">
        {DAYS.map((d, i) => {
          const done = week[i];
          const cls = i === wd ? `now${done ? " done" : ""}` : done ? "done" : "";
          return <div key={d} className={`p-wd ${cls}`}><i>{done && <Check size={12} />}</i>{d}</div>;
        })}
      </div>
      <div className="flex justify-between mt-3 text-xs p-muted">
        <span className="flex gap-1.5 items-center" style={{ color: "var(--gold)" }}><Flame size={14} /><b className="p-num text-[15px]">Racha de {streak?.streak ?? 0}</b></span>
        <span className="flex gap-1.5 items-center" style={{ color: "var(--blue)" }}><Shield size={14} />{demo ? "×" : "Protector ×"}{streak?.protectorAvailable ? 1 : 0}</span>
      </div>
    </section>
  );
}

function ClubBlock({ main, table, me, loaded }) {
  const demo = useDemo();
  if (!loaded) return null;
  if (!main) {
    return (
      <section className="p-sect p-stg" style={{ "--i": 1 }}>
        <h3>Tu club</h3>
        <div className="p-card flex flex-col gap-2.5">
          {!demo && <p className="text-sm p-muted">Juegas contra todos. Con un club juegas contra tus amigos, tus puntos cuentan y se abren los sobres.</p>}
          <div className="p-btns" style={{ marginTop: 0 }}>
            <Link className="p-btn" to="/club?crear=1">Crear club</Link>
            <Link className="p-btn ghost" to="/club">Unirme</Link>
          </div>
        </div>
      </section>
    );
  }
  if (table?.preseason) {
    return (
      <section className="p-sect p-stg" style={{ "--i": 1 }}>
        <h3>{main.name}<Link to="/club">Ver club</Link></h3>
        <div className="p-card flex flex-col gap-2">
          <span><span className="p-seal b">PRETEMPORADA</span> <small className="p-muted">Aún no suman puntos</small></span>
          <p className="text-sm p-muted">{main.members} {main.members === 1 ? "miembro" : "miembros"}.{!demo && (main.owner ? " Cuando estén todos, inicia la temporada desde Club." : " Esperando que el dueño inicie la temporada.")}</p>
        </div>
      </section>
    );
  }
  const rows = table?.table || [];
  const mine = rows.find((r) => r.userId === me);
  const top = rows.slice(0, 3);
  const list = !mine || top.includes(mine) ? top : [...top, mine];
  const above = mine && mine.rank > 1 && (!table.playedToday || table.playedToday.includes(me)) ? rows.filter((r) => r.points > mine.points).at(-1) : null;
  return (
    <section className="p-sect p-stg" style={{ "--i": 1 }}>
      <h3>{main.name}<Link to="/club">Ver club</Link></h3>
      <div className="p-rows">
        {list.map((r) => (
          <div key={r.userId} className={`p-row ${r.userId === me ? "me" : ""}`}>
            <span className="pos">{table.playedToday && !table.playedToday.includes(r.userId) ? "–" : r.rank}</span>
            <Avatar user={{ id: r.userId, username: r.username, avatar: r.avatar, avatar_config: r.avatar_config }} size={34} />
            <span className="nm">{r.userId === me ? "Tú" : r.username}</span>
            {table.playedToday && !table.playedToday.includes(r.userId) ? <span className="p-pend">Pendiente</span> : <span className="pt">{r.points}</span>}
          </div>
        ))}
        {list.length === 0 && <div className="p-card text-sm p-muted text-center">Nadie sumó puntos hoy todavía. Sé el primero.</div>}
      </div>
      {above && <p className="p-gap"><Flame size={14} /><span>Te faltan <b>{above.points - mine.points + 1}</b> para pasar a <b>{above.username}</b></span></p>}
      {mine && mine.rank === 1 && rows.length > 1 && (!table.playedToday || table.playedToday.includes(me)) && <p className="p-gap">Vas primero. <b>Defiende tu puesto.</b></p>}
    </section>
  );
}

function ClubStreak({ data }) {
  const demo = useDemo();
  if (!data || data.members < 2) return null;
  return (
    <section className="p-sect p-stg" style={{ "--i": 2 }}>
      <h3>Racha del club<small style={{ color: "var(--gold)" }}>{data.streak} {data.streak === 1 ? "día" : "días"}</small></h3>
      <div className="p-card">
        <div className="p-cbar"><i style={{ width: `${Math.min(100, (data.playedToday || 0) / data.members * 100)}%` }} /></div>
        {demo ? <p className="mt-2 flex items-baseline justify-between"><b className="p-num" style={{ fontSize: 28 }}>{data.playedToday || 0}<small className="p-muted">/{data.members}</small></b><span className="text-xs p-muted">{data.todayDone ? "Sobre extra ganado" : "jugaron hoy"}</span></p> : <p className="text-sm mt-2.5">{data.todayDone ? "Hoy jugaron todos: el club ganó un sobre extra." : <>Hoy jugaron <b>{data.playedToday || 0} de {data.members}</b>. Si juegan todos, el club gana un sobre extra.</>}</p>}
      </div>
    </section>
  );
}

function CupBlock({ cup }) {
  const demo = useDemo();
  if (!cup || !cup.started) return null;
  let title;
  let sub = "";
  if (cup.members < 2) title = "Invita a 1 amigo más para abrir la copa";
  else if (cup.phase === "clasificacion") {
    title = "Clasificación de lunes a jueves";
    sub = "Tu partido del día suma para el cuadro";
  } else {
    title = cup.cup?.champion ? `Campeón: ${cup.cup.champion.username}` : "Semana de llaves";
    sub = "Cada cruce lo gana el mejor partido del día";
  }
  return (
    <section className="p-sect p-stg" style={{ "--i": 3 }}>
      <h3>Copa de la semana<Link to="/club?tab=copa">Ver cuadro</Link></h3>
      <Link to="/club?tab=copa" className="p-card flex gap-3 items-center">
        <Trophy size={28} style={{ color: "var(--gold)" }} />
        <span><b className="block">{title}</b>{!demo && <small className="p-muted">{sub}</small>}</span>
      </Link>
    </section>
  );
}

// Hoy: lo que importa del día en pocos bloques. El partido del día arriba, tu club
// debajo, la copa y después seguir jugando.
export default function Hoy() {
  const demo = useDemo();
  const { user } = useAuth();
  const { clubs, loaded, main } = useClubs();
  const streak = useStreak();
  const [today, setToday] = useState(null);
  const [table, setTable] = useState(null);
  const [clubStreak, setClubStreak] = useState(null);
  const [cup, setCup] = useState(null);
  const [week, setWeek] = useState(null); // desafío temático de la temporada
  const [synced, setSynced] = useState(null); // partida jugada sin señal que recién se envió
  const [waiting, setWaiting] = useState(() => !!pendingMatch(17));

  useEffect(() => {
    track("abrio_hoy");
    const load = () => api.get("/daily/today").then((r) => setToday(r.data)).catch(() => setToday(false));
    const send = async () => {
      const out = await syncQueue();
      if (!out) return;
      setWaiting(false);
      if (!out.error) { setSynced(out); load(); }
    };
    load();
    send();
    window.addEventListener("online", send);
    api.get("/cards/sbc-tema").then((r) => setWeek(r.data)).catch(() => setWeek(null));
    return () => window.removeEventListener("online", send);
  }, []);

  useEffect(() => {
    if (!main) return;
    api.get(`/clubs/${main.id}/table`, { params: { view: "hoy" } }).then((r) => setTable(r.data)).catch(() => setTable(null));
    api.get(`/clubs/${main.id}/streak`).then((r) => setClubStreak(r.data)).catch(() => setClubStreak(null));
    api.get(`/clubs/${main.id}/cup`).then((r) => setCup(r.data)).catch(() => setCup(null));
  }, [main]);

  const mult = main && main.mode === "total" && main.started ? 2 : 1;

  return (
    <Layout hub>
      <Ceremonia />
      {synced && <p className="p-card text-sm mb-3" role="status" style={{ borderColor: "var(--me-line)" }}>Tu partido se envió al club: sacaste <b>{synced.total}</b>.</p>}
      {waiting && !synced && <p className="p-card text-sm mb-3" role="status" style={{ borderColor: "var(--gold-line)" }}>Tu partido está guardado en el teléfono y se envía solo cuando vuelva la conexión.</p>}

      <header className="p-dhead">
        <div>
          <h1>Hola, {user?.username}</h1>
          <p>{new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Santiago" })}{!demo && " · el partido de hoy es igual para todos."}</p>
        </div>
      </header>

      {/* En teléfono, una columna en el orden del prototipo (order); en computador, dos columnas. */}
      <div className="p-dgrid">
        <div className="p-l">
          <div style={{ order: 1 }}><Hero today={today} streak={streak} mult={mult} /></div>
          <div style={{ order: 2 }} className="mt-4 space-y-3 empty:hidden">
            <TorneoBanner />
            <EventCards groupId={main?.id} played={!!(today && today.result)} />
          </div>
          <div style={{ order: 4 }}><ClubBlock main={main} table={table} me={user?.id} loaded={loaded} /></div>
        </div>
        <div className="p-r">
          <div style={{ order: 3 }}><ClubStreak data={clubStreak} /></div>
          <div style={{ order: 5 }}><CupBlock cup={cup} /></div>
          {week?.theme && (
            <section className="p-sect p-stg" style={{ "--i": 4, order: 6 }}>
              <h3>Esta semana<Link to="/cartas?tab=sbc">Ver SBC</Link></h3>
              <Link to="/cartas?tab=sbc" className="p-card block">
                <b className="block">SBC: 11 de {week.theme.label}</b>
                <small className="p-muted">{week.done ? "Completado" : `${week.owned}/${week.total} repetidas listas`}</small>
                {!week.done && <div className="p-cbar mt-2"><i style={{ width: `${Math.min(100, week.owned / week.total * 100)}%` }} /></div>}
              </Link>
            </section>
          )}
          <section className="p-sect p-stg" style={{ "--i": 5, order: 7 }}>
            <h3>Seguir jugando</h3>
            <div className="p-rows">
              <Link to="/juegos" className="p-row"><span className="nm">Todos los juegos{!demo && <small style={{ color: "var(--mute)" }}>Arcade, con amigos y carrera</small>}</span><ChevronRight size={20} style={{ color: "var(--acc2)" }} /></Link>
              <Link to="/hoy/archivo" className="p-row"><span className="nm">Partidos pasados{!demo && <small style={{ color: "var(--mute)" }}>Sin puntos ni sobre</small>}</span><ChevronRight size={20} style={{ color: "var(--acc2)" }} /></Link>
            </div>
          </section>
          {!demo && loaded && clubs.length > 1 && <p className="text-xs p-dim text-center mt-4" style={{ order: 8 }}>Tu partido de hoy cuenta en los {clubs.length} clubes en los que estás.</p>}
        </div>
      </div>
    </Layout>
  );
}
