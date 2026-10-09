import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gavel, Users, Trophy, Search, Bot } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import useRoomRelay from "../hooks/useRoomRelay.js";
import { useAuth } from "../context/AuthContext.jsx";
import { reportOnlineWin } from "../utils/onlineWin.js";
import { playSfx } from "../utils/sfx.js";
import FormationPitch from "../components/FormationPitch.jsx";
import LivePitch from "../components/LivePitch.jsx";

// Subasta: 2, 4 u 8 DTs con 1000 M cada uno arman su once pujando por jugadores que salen
// en silueta negra. Por cada puesto se subasta hasta que todos tengan uno; al final se juega
// una copa con los once armados (la simula el servidor). La subasta corre en el navegador del
// anfitrión y se reparte por el relay de salas; los bots completan los asientos vacíos.
const GAME = "subasta";
const BUDGET = 1000;
const STEP = 5;
const LOT_MS = 16000;
const EXT_MS = 4000; // una puja en los últimos segundos extiende hasta acá
const REVEAL_MS = 3200;
const FORMATIONS = {
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
};
const POS_LABEL = { GK: "Arquero", DEF: "Defensor", MID: "Mediocampista", FWD: "Delantero" };
const TONE = { GK: "tone-amber", DEF: "tone-blue", MID: "tone-emerald", FWD: "tone-pink" };
const SUPLENTE = { name: "Suplente", ovr: 60, club: "—", nationality: "", photo: null };

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const sameName = (guess, real) => {
  const g = norm(guess), r = norm(real);
  if (!g) return false;
  if (g === r) return true;
  const last = r.split(" ").pop();
  return g.length >= 4 && (g === last || g.split(" ").pop() === last) && last.length >= 4;
};
const myId = () => {
  try {
    let id = sessionStorage.getItem("subasta_player_id");
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("subasta_player_id", id); }
    return id;
  } catch { return Math.random().toString(36).slice(2, 10); }
};
// La silueta se dibuja en un canvas (no hay <img> que arrastrar, abrir ni guardar) y la foto en color
// solo existe en pantalla cuando se revela quién es.
function Silhouette({ src, color = false, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!src || color) return undefined;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      const c = ref.current;
      if (!alive || !c) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#000";
      g.fillRect(0, 0, c.width, c.height);
    };
    img.src = src;
    return () => { alive = false; };
  }, [src, color]);
  if (!src) return null;
  if (color) return <img src={src} alt="" draggable={false} onContextMenu={(e) => e.preventDefault()} className={`${className} select-none pointer-events-none`} />;
  return <canvas ref={ref} aria-hidden="true" onContextMenu={(e) => e.preventDefault()} className={`${className} select-none pointer-events-none`} />;
}

const slotsOf = (formation) => Object.entries(FORMATIONS[formation]).flatMap(([pos, n]) => Array.from({ length: n }, () => pos));
const spent = (p) => p.picks.reduce((s, x) => s + (x?.price || 0), 0);
const maxBidFor = (p, slots) => p.budget - STEP * (p.picks.filter((x, i) => !x).length - 1);

export default function Subasta() {
  const { user } = useAuth();
  const { status, roomCode, role, error, lastMessage, createRoom, joinRoom, send, publishState, leave } = useRoomRelay(GAME);
  const me = useMemo(() => ({ id: myId(), name: user?.username || "Vos" }), [user]);
  const isHost = role === "host";
  const [size, setSize] = useState(4);
  const [formation, setFormation] = useState("4-3-3");
  const [joinCode, setJoinCode] = useState("");
  const [view, setView] = useState(null); // estado público de la partida
  const [recv, setRecv] = useState(Date.now()); // cuándo llegó el último estado (para el reloj)
  const [now, setNow] = useState(Date.now());
  const [reveal, setReveal] = useState(null); // mi acierto privado: { n, name, ovr, club, nat }
  const [guess, setGuess] = useState("");
  const [guessMsg, setGuessMsg] = useState("");
  const [bidText, setBidText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null); // ficha elegida en la cancha para cambiarla de lugar
  const [watch, setWatch] = useState(null); // partido de la copa que se está viendo: null, un número o "fin"
  const [matchDone, setMatchDone] = useState(false);

  // ---- estado del anfitrión (no se comparte entero) ----
  const S = useRef(null); // estado público
  const host = useRef({ queue: {}, cur: null, deadline: 0, revealUntil: 0, counter: 0, tries: {}, lastPub: 0, timer: null, reported: false });
  const viewRef = useRef(null);
  useEffect(() => { viewRef.current = view; }, [view]);

  const commit = useCallback((force = true) => {
    if (!S.current) return;
    const snap = JSON.parse(JSON.stringify(S.current));
    setView(snap);
    setRecv(Date.now());
    if (force || Date.now() - host.current.lastPub > 900) {
      host.current.lastPub = Date.now();
      publishState(snap);
    }
  }, [publishState]);

  // ---- entrada a la sala ----
  useEffect(() => {
    if (status !== "in-room") return;
    if (isHost) {
      S.current = { phase: "lobby", size, formation, players: [{ id: me.id, name: me.name, bot: false, budget: BUDGET, picks: [] }], slots: slotsOf(formation), slotIdx: 0, lot: null, log: "", cup: null, v: 1 };
      commit();
    } else {
      send({ type: "hello", id: me.id, name: me.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ---- mensajes ----
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "state-sync" && !isHost) {
      setView(lastMessage.payload);
      setRecv(Date.now());
      // si todavía no figuro en la lista, me anuncio de nuevo
      if (lastMessage.payload?.phase === "lobby" && !lastMessage.payload.players.some((p) => p.id === me.id)) send({ type: "hello", id: me.id, name: me.name });
      return;
    }
    if (lastMessage.type !== "relay") return;
    const m = lastMessage.payload;
    if (!m || typeof m.type !== "string") return;
    if (m.type === "reveal") {
      if (m.to === me.id) { setReveal(m); setGuessMsg(`¡Era ${m.name}!`); playSfx("ok"); }
      return;
    }
    if (!isHost || !S.current) return;
    const st = S.current;
    if (m.type === "hello") {
      if (st.phase === "lobby" && !st.players.some((p) => p.id === m.id) && st.players.length < st.size) {
        st.players.push({ id: String(m.id), name: String(m.name || "Jugador").slice(0, 20), bot: false, budget: BUDGET, picks: [] });
        commit();
      }
    } else if (m.type === "bid") hostBid(String(m.id), Number(m.amount));
    else if (m.type === "guess") hostGuess(String(m.id), String(m.text || ""));
    else if (m.type === "swap") hostSwap(String(m.id), Number(m.i), Number(m.j));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  // ---- reloj de pantalla ----
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // ================= lógica de la subasta (solo anfitrión) =================
  function hostBid(id, amount) {
    const st = S.current;
    if (!st || st.phase !== "auction" || !st.lot || st.lot.rev) return;
    const lot = st.lot;
    const p = st.players.find((x) => x.id === id);
    if (!p || !lot.eligible.includes(id)) return;
    const need = lot.best ? lot.best.amount + STEP : lot.minBid;
    if (!Number.isFinite(amount) || amount < need) return;
    amount = Math.round(amount / STEP) * STEP;
    if (amount > maxBidFor(p, st.slots)) return;
    if (lot.best?.id === id) return;
    lot.best = { id, amount };
    const left = host.current.deadline - Date.now();
    if (left < EXT_MS) host.current.deadline = Date.now() + EXT_MS;
    commit();
  }

  // Intercambia dos jugadores ya ganados de un participante (solo fichas llenas, así no se rompe la subasta).
  function hostSwap(id, i, j) {
    const st = S.current;
    const p = st?.players.find((x) => x.id === id);
    if (!p || !Number.isInteger(i) || !Number.isInteger(j) || i === j || !p.picks[i] || !p.picks[j]) return;
    [p.picks[i], p.picks[j]] = [p.picks[j], p.picks[i]];
    commit();
  }

  function hostGuess(id, text) {
    const st = S.current, h = host.current;
    if (!st?.lot || st.lot.rev || !h.cur) return;
    const key = `${st.lot.n}:${id}`;
    h.tries[key] = (h.tries[key] || 0) + 1;
    if (h.tries[key] > 3) return;
    if (sameName(text, h.cur.name)) {
      if (!st.lot.guessed.includes(id)) st.lot.guessed.push(id);
      send({ type: "reveal", to: id, n: st.lot.n, name: h.cur.name, ovr: h.cur.ovr, club: h.cur.club, nat: h.cur.nationality, photo: h.cur.photo });
      if (id === me.id) { setReveal({ n: st.lot.n, name: h.cur.name, ovr: h.cur.ovr, club: h.cur.club, nat: h.cur.nationality, photo: h.cur.photo }); setGuessMsg(`¡Era ${h.cur.name}!`); }
      commit();
    } else if (id === me.id) setGuessMsg(`No es. Te quedan ${3 - h.tries[key]} intentos.`);
  }

  async function startAuction() {
    const st = S.current;
    setBusy(true); setErr("");
    try {
      const bots = Math.max(0, st.size - st.players.length);
      for (let i = 0; i < bots; i++) st.players.push({ id: `bot${i + 1}`, name: `Bot ${i + 1}`, bot: true, budget: BUDGET, picks: [] });
      st.slots = slotsOf(st.formation);
      st.players.forEach((p) => { p.budget = BUDGET; p.picks = st.slots.map(() => null); });
      const F = FORMATIONS[st.formation];
      const n = st.size;
      const { data } = await api.get("/subasta/pool", { params: { gk: F.GK * n + 2, def: F.DEF * n + 3, mid: F.MID * n + 3, fwd: F.FWD * n + 3 } });
      const queue = { GK: [], DEF: [], MID: [], FWD: [] };
      data.lots.forEach((l) => queue[l.pos]?.push(l));
      const short = Object.keys(F).find((pos) => queue[pos].length < F[pos] * n);
      if (short) { setErr(`Todavía no hay suficientes jugadores con foto para ${POS_LABEL[short]}. Probá con menos jugadores.`); S.current.players = S.current.players.filter((p) => !p.bot); setBusy(false); return; }
      host.current = { ...host.current, queue, cur: null, counter: 0, tries: {}, reported: false };
      st.phase = "auction"; st.slotIdx = 0; st.log = "¡Empieza la subasta!";
      nextLot();
      clearInterval(host.current.timer);
      host.current.timer = setInterval(tick, 250);
    } catch {
      setErr("No se pudo armar la subasta. Probá de nuevo.");
    }
    setBusy(false);
  }

  function nextLot() {
    const st = S.current, h = host.current;
    // ¿alguien se quedó sin plata para este puesto? entra un suplente
    for (;;) {
      const elig = st.players.filter((p) => !p.picks[st.slotIdx]);
      if (elig.length === 0) { st.slotIdx++; if (st.slotIdx >= st.slots.length) return finishAuction(); continue; }
      elig.forEach((p) => { if (maxBidFor(p, st.slots) < STEP) p.picks[st.slotIdx] = { ...SUPLENTE, pos: st.slots[st.slotIdx], price: 0 }; });
      if (st.players.some((p) => !p.picks[st.slotIdx])) break;
    }
    const pos = st.slots[st.slotIdx];
    const eligible = st.players.filter((p) => !p.picks[st.slotIdx]).map((p) => p.id);
    const lot = h.queue[pos].shift();
    if (!lot) { // no quedan jugadores de ese puesto: suplentes para los que faltan
      st.players.forEach((p) => { if (!p.picks[st.slotIdx]) p.picks[st.slotIdx] = { ...SUPLENTE, pos, price: 0 }; });
      return nextLot();
    }
    h.cur = lot;
    h.counter += 1;
    h.deadline = Date.now() + LOT_MS;
    st.lot = { n: h.counter, pos, minBid: lot.minBid, photo: lot.photo, eligible, best: null, turn: null, guessed: [], hint: null, rev: null, msLeft: LOT_MS, total: LOT_MS };
    // Turnos: cada lote le toca a uno (van rotando) y quien tiene el turno abre sí o sí con la puja mínima.
    for (let k = 0; k < eligible.length; k++) {
      const pid = eligible[(h.counter - 1 + k) % eligible.length];
      const tp = st.players.find((x) => x.id === pid);
      if (tp && maxBidFor(tp, st.slots) >= lot.minBid) {
        st.lot.turn = pid;
        st.lot.best = { id: pid, amount: lot.minBid };
        break;
      }
    }
    commit();
  }

  function resolveLot() {
    const st = S.current, h = host.current, lot = st.lot, cur = h.cur;
    let winner = lot.best ? st.players.find((p) => p.id === lot.best.id) : null;
    let price = lot.best?.amount || 0;
    let note;
    if (!winner) {
      const elig = st.players.filter((p) => lot.eligible.includes(p.id));
      if (elig.length === 1 && maxBidFor(elig[0], st.slots) >= lot.minBid) { winner = elig[0]; price = lot.minBid; note = " (único que quedaba: a la mínima)"; }
    }
    if (winner) {
      winner.budget -= price;
      winner.picks[st.slotIdx] = { name: cur.name, ovr: cur.ovr, club: cur.club, nationality: cur.nationality, photo: cur.photo, pos: cur.pos, price };
      st.log = `${winner.name} se lleva a ${cur.name} (${cur.ovr}) por ${price} M${note || ""}`;
      playSfx(winner.id === me.id ? "ok" : "tap");
    } else {
      st.log = `Sin pujas: ${cur.name} (${cur.ovr}) queda libre.`;
    }
    lot.rev = { name: cur.name, ovr: cur.ovr, club: cur.club, nationality: cur.nationality, photo: cur.photo, winner: winner?.id || null, price };
    h.revealUntil = Date.now() + REVEAL_MS;
    commit();
  }

  function botTurn() {
    const st = S.current, h = host.current, lot = st.lot, cur = h.cur;
    if (!lot || lot.rev || !cur) return;
    st.players.filter((p) => p.bot && lot.eligible.includes(p.id) && lot.best?.id !== p.id).forEach((b) => {
      // cada bot tiene su "sensación" del valor (±25%) y puja de a poco, con algo de azar
      b.sense = b.sense && b.senseLot === lot.n ? b.sense : 0.7 + Math.random() * 0.45;
      b.senseLot = lot.n;
      const cap = Math.min(maxBidFor(b, st.slots), Math.round((cur.value * b.sense) / STEP) * STEP);
      const need = lot.best ? lot.best.amount + STEP : lot.minBid;
      if (need <= cap && Math.random() < 0.09) hostBid(b.id, need + (Math.random() < 0.3 ? STEP : 0));
    });
  }

  function tick() {
    const st = S.current, h = host.current;
    if (!st || st.phase !== "auction") return;
    const lot = st.lot;
    if (!lot) return;
    if (lot.rev) {
      if (Date.now() >= h.revealUntil) { st.lot = null; nextLot(); }
      return;
    }
    const left = h.deadline - Date.now();
    lot.msLeft = Math.max(0, left);
    lot.total = Math.max(LOT_MS, left);
    const hint = left <= 5500 ? 2 : left <= 10500 ? 1 : 0;
    if (hint !== (lot.hint || 0)) {
      lot.hint = hint;
      if (hint >= 1) lot.nat = h.cur.nationality;
      if (hint >= 2) lot.club = h.cur.club;
      commit();
    }
    botTurn();
    if (left <= 0) return resolveLot();
    commit(false);
  }

  async function finishAuction() {
    const st = S.current, h = host.current;
    clearInterval(h.timer);
    st.lot = null; st.phase = "cup"; st.log = "Subasta terminada: se juega la copa.";
    commit();
    try {
      const teams = st.players.map((p) => ({ id: p.id, name: p.name, xi: p.picks.map((x) => ({ name: x.name, pos: x.pos, ovr: x.ovr })) }));
      const { data } = await api.post("/subasta/cup", { teams });
      st.cup = data;
      st.phase = "done";
      commit();
    } catch {
      st.log = "No se pudo simular la copa.";
      st.phase = "done";
      commit();
    }
  }
  useEffect(() => () => clearInterval(host.current.timer), []);

  // ---- acciones del jugador ----
  const lot = view?.lot;
  const meP = view?.players?.find((p) => p.id === me.id);
  const canBid = !!(view?.phase === "auction" && lot && !lot.rev && lot.eligible.includes(me.id));
  const price = lot?.best ? lot.best.amount : 0;
  const need = lot ? (lot.best ? lot.best.amount + STEP : lot.minBid) : 0;
  const cap = meP && view ? maxBidFor(meP, view.slots) : 0;
  function bid(amount) {
    if (!canBid) return;
    if (isHost) hostBid(me.id, amount); else send({ type: "bid", id: me.id, amount });
  }
  function swapPicks(i, j) {
    if (isHost) hostSwap(me.id, i, j); else send({ type: "swap", id: me.id, i, j });
  }
  function pickSlot(i) {
    if (sel === null) { setSel(i); return; }
    if (sel === i) { setSel(null); return; }
    swapPicks(sel, i);
    setSel(null);
  }
  function submitGuess(e) {
    e.preventDefault();
    if (!guess.trim() || !lot) return;
    if (isHost) hostGuess(me.id, guess); else send({ type: "guess", id: me.id, text: guess });
    setGuess("");
  }
  useEffect(() => { setReveal((r) => (r && lot && r.n !== lot.n ? null : r)); setGuessMsg(""); }, [lot?.n]);

  // el campeón avisa (una vez) para sumar sus puntos
  useEffect(() => {
    if (view?.phase !== "done" || !view.cup || host.current.reported) return;
    host.current.reported = true;
    if (view.cup.champion === me.id) {
      const humans = view.players.filter((p) => !p.bot).length;
      reportOnlineWin("subasta", Math.max(0, humans - 1), roomCode);
      playSfx("win");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.phase]);

  const msLeft = lot && !lot.rev ? Math.max(0, lot.msLeft - (now - recv)) : 0;
  const secs = Math.ceil(msLeft / 1000);
  const playing = view?.phase === "auction";

  // =============================== pantallas ===============================
  if (status === "idle" || status === "connecting" || status === "error" || !view) {
    return (
      <Layout>
        <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2"><Gavel size={22} className="text-accent" /> Subasta</h1>
        <p className="text-gray-400 text-sm mb-5">Cada uno tiene {BUDGET} M para armar su once pujando por jugadores que salen en silueta negra. Al final, una copa con los equipos armados.</p>
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="hero-b rounded-3xl p-5 sm:p-6" style={{ "--hero-a": "var(--c-amber)", "--hero-b": "var(--c-pink)" }}>
            <h2 className="font-bold text-lg mb-3">Crear sala</h2>
            <p className="text-xs uppercase tracking-wide text-gray-300 mb-1.5">Jugadores (los asientos vacíos los completan bots)</p>
            <div className="flex gap-2 mb-4">
              {[2, 4, 8].map((n) => (
                <button key={n} onClick={() => setSize(n)} className={`px-5 py-2 rounded-full text-sm font-semibold border ${size === n ? "bg-white text-black border-white" : "border-white/30 text-gray-200"}`}>{n}</button>
              ))}
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-300 mb-1.5">Formación</p>
            <div className="flex gap-2 mb-5 flex-wrap">
              {Object.keys(FORMATIONS).map((f) => (
                <button key={f} onClick={() => setFormation(f)} className={`px-4 py-2 rounded-full text-sm font-semibold border ${formation === f ? "bg-white text-black border-white" : "border-white/30 text-gray-200"}`}>{f}</button>
              ))}
            </div>
            <button onClick={() => createRoom(size)} className="btn btn-primary w-full">Crear sala</button>
          </div>
          <Card>
            <h2 className="font-bold text-lg mb-3">Unirme con un código</h2>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Código de la sala"
              maxLength={6}
              className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm tracking-widest mb-3 focus:outline-none focus:border-accent"
            />
            <button onClick={() => joinCode.trim() && joinRoom(joinCode.trim())} disabled={!joinCode.trim()} className="btn btn-secondary w-full">Unirme</button>
          </Card>
        </div>
      </Layout>
    );
  }

  if (view.phase === "lobby") {
    const missing = view.size - view.players.length;
    return (
      <Layout>
        <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2"><Gavel size={22} className="text-accent" /> Sala {roomCode}</h1>
        <p className="text-gray-400 text-sm mb-5">Formación {view.formation} · {view.size} jugadores · {BUDGET} M cada uno. Compartí el código para que se sumen.</p>
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          {Array.from({ length: view.size }, (_, i) => view.players[i] || null).map((p, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${p ? "border-border bg-panel" : "border-dashed border-border text-gray-500"}`}>
              <span className="w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold">{p ? p.name[0].toUpperCase() : "?"}</span>
              <span className="font-medium">{p ? p.name : "Esperando… (si no llega, juega un bot)"}</span>
              {p?.id === me.id && <span className="ml-auto text-xs text-accent">Vos</span>}
            </div>
          ))}
        </div>
        {isHost ? (
          <>
            <button onClick={startAuction} disabled={busy || view.players.length < 1} className="btn btn-primary w-full sm:w-auto">
              {busy ? "Preparando…" : missing > 0 ? `Empezar (${missing} bot${missing > 1 ? "s" : ""})` : "Empezar la subasta"}
            </button>
            {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
          </>
        ) : (
          <p className="text-sm text-gray-400">Esperando que el anfitrión empiece…</p>
        )}
        <button onClick={leave} className="block mt-6 text-xs text-gray-500 hover:text-white">Salir de la sala</button>
      </Layout>
    );
  }

  const F = FORMATIONS[view.formation];
  const bidderName = lot?.best ? view.players.find((p) => p.id === lot.best.id)?.name : null;
  const iGuessed = !!(lot && (reveal?.n === lot.n));
  const showPhoto = lot?.rev ? lot.rev.photo : iGuessed ? reveal.photo || lot.photo : lot?.photo;
  const unmasked = !!(lot?.rev || iGuessed);

  return (
    <Layout focus={playing} wide>
      {playing && lot && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
            <span className="text-gray-400">
              <b className={`${TONE[lot.pos]} text-tone`}>{POS_LABEL[lot.pos]}</b> · puesto {view.slotIdx + 1} de {view.slots.length} · lote {lot.n}
            </span>
            <span className="font-semibold tabular-nums">Tu presupuesto: <span className="text-accent">{meP?.budget ?? 0} M</span></span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
            <div className="hero-b rounded-3xl p-4 sm:p-6" style={{ "--hero-a": "var(--c-amber)", "--hero-b": "var(--c-blue)" }}>
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-56 h-64 sm:w-64 sm:h-72 rounded-3xl flex items-end justify-center overflow-hidden" style={{ background: "radial-gradient(circle at 50% 35%, #fbfcfd, #c9d1d8)" }}>
                  {showPhoto && <Silhouette src={showPhoto} color={unmasked} className="h-full w-auto object-contain" />}
                  <span className="absolute top-2 right-2 text-xs font-bold rounded-full bg-black/70 text-white px-2.5 py-1 tabular-nums">{lot.rev ? "Vendido" : `${secs}s`}</span>
                </div>
                {unmasked ? (
                  <div className="text-center">
                    <p className="text-2xl font-extrabold">{(lot.rev || reveal).name}</p>
                    <p className="text-sm text-gray-300">{(lot.rev || reveal).club} · OVR {(lot.rev || reveal).ovr} {(lot.rev || reveal).nationality ? `· ${(lot.rev || reveal).nationality}` : ""}</p>
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-300">
                    <p className="font-semibold text-base">Puja mínima: {lot.minBid} M</p>
                    <p className="mt-1">{lot.nat ? `Nacionalidad: ${lot.nat}` : "Pista de nacionalidad a los 10 s"}{lot.club ? ` · Club: ${lot.club}` : ""}</p>
                  </div>
                )}

                {lot.turn && !lot.rev && (
                  <p className="text-sm text-center text-amber-200">
                    Turno de <b>{view.players.find((p) => p.id === lot.turn)?.name}{lot.turn === me.id ? " (vos)" : ""}</b>: abrió con la mínima ({lot.minBid} M).
                  </p>
                )}
                <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/25 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-gray-300">Puja más alta</p>
                  <p className="text-3xl font-extrabold tabular-nums">{lot.best ? `${price} M` : "—"}</p>
                  <p className="text-sm text-gray-300">{bidderName ? `de ${bidderName}` : "Nadie pujó todavía"}</p>
                </div>

                {!lot.rev && canBid && (
                  <div className="w-full max-w-md space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      {[need, need + STEP * 2, need + STEP * 6].map((a, i) => (
                        <button key={i} onClick={() => bid(a)} disabled={a > cap || lot.best?.id === me.id} className="btn btn-primary !h-11 text-sm disabled:opacity-30">{a} M</button>
                      ))}
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); bid(Number(bidText)); setBidText(""); }} className="flex gap-2">
                      <input value={bidText} onChange={(e) => setBidText(e.target.value.replace(/\D/g, ""))} placeholder={`Otra cifra (máx. ${cap} M)`} inputMode="numeric" className="flex-1 bg-bg border border-border rounded-card px-3 py-2 text-sm focus:outline-none focus:border-accent" />
                      <button className="btn btn-secondary" disabled={!bidText}>Pujar</button>
                    </form>
                    {lot.best?.id === me.id && <p className="text-xs text-accent text-center">Vas ganando. Si nadie sube, es tuyo.</p>}
                  </div>
                )}
                {!lot.rev && !canBid && <p className="text-sm text-gray-300">Ya tenés este puesto: mirá cómo pujan los demás.</p>}

                {!lot.rev && canBid && !iGuessed && (
                  <form onSubmit={submitGuess} className="w-full max-w-md flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="¿Quién es? Adiviná (3 intentos)" className="w-full bg-bg border border-border rounded-card pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-accent" />
                    </div>
                    <button className="btn btn-secondary" disabled={!guess.trim()}>Adivinar</button>
                  </form>
                )}
                {guessMsg && <p className="text-sm font-semibold text-accent">{guessMsg}</p>}
                {lot.guessed.length > 0 && !lot.rev && <p className="text-xs text-gray-300">Ya lo reconocieron: {lot.guessed.map((id) => view.players.find((p) => p.id === id)?.name).join(", ")}</p>}
              </div>
            </div>

            <div className="space-y-3">
              {meP && (
                <div>
                  <p className="t-eyebrow mb-2">Tu equipo · tocá dos jugadores para cambiarlos de lugar</p>
                  <FormationPitch slots={view.slots} picks={meP.picks} selected={sel} onSelect={pickSlot} />
                </div>
              )}
              {view.players.map((p, i) => {
                const filled = p.picks.filter(Boolean).length;
                return (
                  <div key={p.id} className={`tone-${["accent", "blue", "purple", "amber", "pink", "cyan", "red", "emerald"][i % 8]} rounded-2xl border px-4 py-3 ${lot.best?.id === p.id ? "tile-b" : "border-border bg-panel"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold flex items-center gap-1.5 truncate">{p.bot && <Bot size={13} className="text-gray-500" />}{p.name}{p.id === me.id && <span className="text-xs text-accent">(vos)</span>}</span>
                      <span className="tabular-nums text-sm text-tone font-bold">{p.budget} M</span>
                    </div>
                    <div className="flex gap-1 mt-2" title={`${filled} de ${view.slots.length}`}>
                      {view.slots.map((pos, k) => <span key={k} className={`flex-1 h-1.5 rounded-full ${p.picks[k] ? "bg-tone" : "bg-white/10"}`} />)}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-gray-400 px-1 min-h-[2.5rem]">{view.log}</p>
            </div>
          </div>
        </div>
      )}

      {view.phase === "cup" && (
        <Card className="text-center py-10"><Trophy size={30} className="mx-auto text-accent mb-3" /><p className="font-semibold">Subasta terminada</p><p className="text-sm text-gray-400 mt-1">Armando los partidos de la copa…</p></Card>
      )}

      {view.phase === "done" && (() => {
        const rounds = view.cup?.rounds || [];
        const flat = rounds.flatMap((r) => r.matches.map((m) => ({ r, m })));
        const lineup = (id) => {
          const p = view.players.find((x) => x.id === id);
          return { name: p?.name || "—", xi: (p?.picks || []).map((x) => ({ name: x?.name, pos: x?.pos })) };
        };
        const cur = typeof watch === "number" ? flat[watch] : null;
        const showResults = !view.cup || watch === "fin";
        return (
          <div className="space-y-5">
            {view.cup && watch === null && (
              <div className="hero-b rounded-3xl p-6 text-center space-y-3" style={{ "--hero-a": "var(--c-amber)", "--hero-b": "var(--c-accent)" }}>
                <Trophy size={34} className="mx-auto text-amber" />
                <p className="text-xl font-extrabold">¡Empieza la copa!</p>
                <p className="text-sm text-gray-200">{flat.length} partido{flat.length === 1 ? "" : "s"}, minuto a minuto, con la cancha para ver hacia qué arco hay peligro.</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button onClick={() => { setWatch(0); setMatchDone(false); }} className="btn btn-primary">Ver los partidos</button>
                  <button onClick={() => setWatch("fin")} className="btn btn-secondary">Saltar a los resultados</button>
                </div>
              </div>
            )}

            {cur && (
              <div className="space-y-3 max-w-3xl mx-auto">
                <p className="t-eyebrow">{cur.r.name} · partido {watch + 1} de {flat.length}</p>
                <LivePitch key={watch} home={lineup(cur.m.a)} away={lineup(cur.m.b)} match={cur.m} onDone={() => setMatchDone(true)} />
                {matchDone && cur.m.penalties && <p className="text-sm text-center text-gray-300">Empate: definió por penales {view.players.find((p) => p.id === cur.m.winner)?.name}.</p>}
                <div className="flex gap-2 justify-center">
                  {matchDone && (
                    <button onClick={() => { setMatchDone(false); setWatch(watch + 1 < flat.length ? watch + 1 : "fin"); }} className="btn btn-primary">
                      {watch + 1 < flat.length ? "Siguiente partido" : "Ver resultados"}
                    </button>
                  )}
                  <button onClick={() => setWatch("fin")} className="btn btn-secondary">Saltar a los resultados</button>
                </div>
              </div>
            )}

            {showResults && (
              <>
                {view.cup ? (
                  <div className="hero-b rounded-3xl p-6 text-center" style={{ "--hero-a": "var(--c-amber)", "--hero-b": "var(--c-accent)" }}>
                    <Trophy size={34} className="mx-auto text-amber mb-2" />
                    <p className="text-xs uppercase tracking-wide text-gray-300">Campeón de la copa</p>
                    <p className="text-3xl font-extrabold">{view.players.find((p) => p.id === view.cup.champion)?.name}</p>
                    {view.cup.champion === me.id && <p className="text-sm text-accent mt-1">¡Ganaste!</p>}
                  </div>
                ) : <p className="text-sm text-red-400">{view.log}</p>}

                {view.cup?.rounds.map((r) => (
                  <div key={r.name}>
                    <h2 className="t-eyebrow mb-2">{r.name}</h2>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {r.matches.map((m, i) => {
                        const A = view.players.find((p) => p.id === m.a), B = view.players.find((p) => p.id === m.b);
                        return (
                          <Card key={i}>
                            <div className="flex items-center justify-between gap-3">
                              <span className={`font-semibold truncate ${m.winner === m.a ? "text-accent" : ""}`}>{A?.name}</span>
                              <span className="text-2xl font-extrabold tabular-nums shrink-0">{m.goalsA} - {m.goalsB}</span>
                              <span className={`font-semibold truncate text-right ${m.winner === m.b ? "text-accent" : ""}`}>{B?.name}</span>
                            </div>
                            {m.penalties && <p className="text-xs text-gray-400 text-center mt-1">Definió por penales: {m.penalties === "a" ? A?.name : B?.name}</p>}
                            {(m.scorersA.length > 0 || m.scorersB.length > 0) && (
                              <p className="text-xs text-gray-400 mt-2">⚽ {[...m.minsA.map((mn, k) => `${mn}' ${m.scorersA[k]}`), ...m.minsB.map((mn, k) => `${mn}' ${m.scorersB[k]}`)].join(", ")}</p>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div>
                  <h2 className="t-eyebrow mb-2">Los equipos</h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {view.players.map((p) => (
                      <Card key={p.id}>
                        <div className="flex items-center justify-between mb-2 gap-2"><b className="truncate">{p.name}</b><span className="text-xs text-gray-400 shrink-0">Fuerza {view.cup?.strengths?.[p.id] ?? "—"} · sobran {p.budget} M</span></div>
                        <FormationPitch slots={view.slots} picks={p.picks} />
                      </Card>
                    ))}
                  </div>
                </div>
                <button onClick={leave} className="btn btn-secondary">Salir de la sala</button>
              </>
            )}
          </div>
        );
      })()}
    </Layout>
  );
}
