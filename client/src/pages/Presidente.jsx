import { useEffect, useMemo, useState } from "react";
import {
  Award, Building2, Coins, Crown, Gavel, Handshake, Heart, Landmark, ListOrdered, Megaphone,
  Newspaper, Search, ShieldX, Target, Trophy, Tv, UserPlus, Users, Vote, Wallet,
} from "lucide-react";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import api from "../api.js";
import { useGroups } from "../context/GroupContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { teamsByLeague, teamById } from "../carrera/data/teams.js";
import TeamCrest from "../carrera/components/TeamCrest.jsx";
import * as E from "../presidente/engine.js";
import { buildPresidenteLegacy } from "../presidente/legacy.js";

const SAVE_KEY = "presidente_v1"; // mismo nombre: Vida FUT y "Seguir jugando" lo leen

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? E.migrateState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* sin storage disponible: no rompe el juego */
  }
}

const money = (n) => `€${Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10}M`;
const perWeek = (n) => `€${(Math.round(n * 100) / 100).toFixed(2)}M/sem`;

function color(v) {
  return v >= 60 ? "rgb(var(--c-emerald))" : v >= 30 ? "rgb(var(--c-amber))" : "rgb(var(--c-red))";
}

function Bar({ label, value, hint }) {
  const v = Math.round(value);
  return (
    <div title={hint}>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-semibold" style={{ color: color(v) }}>{v}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color(v) }} />
      </div>
    </div>
  );
}

function Btn({ children, onClick, disabled, tone = "default", className = "" }) {
  const tones = {
    default: "border-border bg-bg hover:border-accent/40",
    accent: "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
    danger: "border-red-500/30 bg-red-500/5 text-red-300 hover:border-red-500/50",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2.5 rounded-card border text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

function Title({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} className="text-accent shrink-0" />
      <h3 className="font-semibold flex-1">{children}</h3>
      {right}
    </div>
  );
}

// Mini gráfico de la caja de las últimas semanas.
function Sparkline({ values }) {
  if (values.length < 2) return null;
  const w = 64, h = 22;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  const [lx, ly] = pts.split(" ").pop().split(",");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Caja de las últimas semanas" role="img" className={up ? "text-good" : "text-bad"}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.2" fill="currentColor" />
    </svg>
  );
}

// Ingresos contra gastos de cada temporada cerrada (más la en curso).
function SeasonBars({ state }) {
  const rows = [...(state.history || [])].reverse().filter((h) => h.income != null).map((h) => ({ label: `T${h.season}`, income: h.income, expense: h.expense }));
  if (!rows.length) return <p className="text-xs text-gray-500">Cuando cierres la primera temporada vas a ver acá los ingresos contra los gastos.</p>;
  const max = Math.max(...rows.flatMap((r) => [r.income, r.expense]), 1);
  const step = Math.ceil(max / 4 / 10) * 10 || 10;
  const top = step * 4;
  const W = 300, H = 130, padL = 30, padB = 18, colW = (W - padL) / rows.length;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label="Ingresos y gastos por temporada">
        {[0, 1, 2, 3, 4].map((i) => {
          const y = 8 + (H - padB - 8) * (1 - i / 4);
          return (
            <g key={i}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.12" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="8" fill="currentColor" opacity="0.6">{i * step}</text>
            </g>
          );
        })}
        {rows.map((r, i) => {
          const x = padL + i * colW + colW * 0.15;
          const bw = colW * 0.33;
          const hh = (v) => ((H - padB - 8) * v) / top;
          return (
            <g key={r.label}>
              <rect x={x} y={H - padB - hh(r.income)} width={bw} height={hh(r.income)} fill="rgb(var(--c-emerald))" rx="2" />
              <rect x={x + bw + 2} y={H - padB - hh(r.expense)} width={bw} height={hh(r.expense)} fill="rgb(var(--c-red))" rx="2" />
              <text x={x + bw} y={H - 5} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.7">{r.label}</text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-gray-500 mt-1 flex items-center gap-3">
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-good inline-block" />Ingresos (€M)</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-bad inline-block" />Gastos (€M)</span>
      </p>
    </div>
  );
}

// Sección con título, para apilar varias en una misma pestaña.
function Section({ title, children }) {
  return (
    <section className="space-y-5">
      <h2 className="t-eyebrow border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

// ------------------------------------------------------------ inicio de gestión
function ClubPicker({ onStart }) {
  const [league, setLeague] = useState("premier");
  const [team, setTeam] = useState(null);
  const [philosophy, setPhilosophy] = useState("equilibrado");
  const list = teamsByLeague(league);

  if (team) {
    return (
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <TeamCrest team={team} size={40} />
          <div>
            <h3 className="font-semibold">Vas a presidir a {team.name}</h3>
            <p className="text-xs text-gray-500">Objetivo de la directiva: {E.objectiveFor(team.id).label}</p>
          </div>
        </div>
        <p className="text-sm font-medium mb-2">Elegí la filosofía deportiva del club</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {Object.entries(E.PHILOSOPHIES).map(([key, p]) => (
            <button
              key={key}
              onClick={() => setPhilosophy(key)}
              className={`text-left px-3 py-3 rounded-card border transition-colors ${philosophy === key ? "border-accent bg-accent/10" : "border-border bg-bg hover:border-accent/40"}`}
            >
              <p className="text-sm font-semibold">{p.icon} {p.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onStart(team, philosophy)} className="btn btn-primary flex-1">Asumir la presidencia</button>
          <button onClick={() => setTeam(null)} className="px-4 py-2.5 rounded-2xl border border-border text-sm text-gray-400">Volver</button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-semibold mb-4">Elegí el club que vas a presidir</h3>
      <div className="flex gap-2 mb-4">
        {["premier", "laliga"].map((l) => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={`px-3 py-1.5 rounded-card text-sm font-medium border transition-colors ${league === l ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400"}`}
          >
            {l === "premier" ? "Premier League" : "La Liga"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => setTeam(t)}
            className="flex items-center gap-2.5 px-3 py-3 rounded-card border border-border bg-bg hover:border-accent/40 transition-colors text-left"
          >
            <TeamCrest team={t} size={32} />
            <span className="text-sm font-medium truncate">{t.name}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ Despacho
function Despacho({ state, act }) {
  const objective = E.objectiveFor(state.teamId);
  const pos = E.myLeaguePosition(state);
  const alerts = [];
  if (!state.dtName) alerts.push("El banco está vacío: elegí un DT en la pestaña Fútbol para poder avanzar.");
  if (state.debt > E.DEBT_CEILING) alerts.push("Límite salarial de emergencia: con esta deuda no podés invertir en nada nuevo hasta bajarla.");
  if (state.tv && state.tv.seasonsLeft <= 0) alerts.push("Se venció el contrato de TV: negociá uno nuevo en Dinero.");
  if (!state.tv) alerts.push("No tenés contrato de TV.");
  const expiring = state.squad.filter((p) => p.contract <= 1);
  if (expiring.length) alerts.push(`${expiring.length} jugador${expiring.length > 1 ? "es" : ""} en su último año de contrato (Fútbol).`);
  if (state.dtName && state.dtContract <= 1) alerts.push(`El contrato de ${state.dtName} vence a fin de temporada.`);
  const toElection = E.seasonsToElection(state);
  if (toElection === 1) alerts.push("Este año hay elecciones al cierre de la temporada. Mirá la pestaña Gente.");

  return (
    <div className="space-y-5">
      {alerts.length > 0 && (
        <Card>
          <Title icon={Megaphone}>Pendientes en tu escritorio</Title>
          <ul className="space-y-1.5">
            {alerts.map((a, i) => <li key={i} className="text-sm text-amber">• {a}</li>)}
          </ul>
        </Card>
      )}

      {state.pendingSale && (
        <Card>
          <Title icon={Coins}>Oferta por {state.pendingSale.player} ({state.pendingSale.ovr})</Title>
          <p className="text-sm text-gray-300 mb-4">Te ofrecen {money(state.pendingSale.amount)}. Venderlo suma caja pero resiente al plantel y a la hinchada.</p>
          <div className="flex gap-2">
            <button onClick={() => act(E.resolveSaleOffer, true)} className="btn btn-primary flex-1">Vender</button>
            <button onClick={() => act(E.resolveSaleOffer, false)} className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-2xl border border-border">Rechazar</button>
          </div>
        </Card>
      )}

      <Card>
        <Title icon={Newspaper}>Decisión de la semana</Title>
        {state.missions?.length > 0 && (
          <div className="mb-4 pb-4 border-b border-border">
            <p className="t-eyebrow mb-2 flex items-center gap-1.5"><Target size={12} /> Misiones de la semana</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {state.missions.map((m) => (
                <div key={m.id} className="rounded-card border border-border bg-bg px-3 py-2.5">
                  <p className="text-sm">{m.label}</p>
                  <p className="text-xs text-accent mt-0.5">{m.rewardLabel}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {state.currentDecision && !state.decisionUsed ? (
          <div>
            <div className="rounded-card border-l-2 border-accent bg-white/5 px-3.5 py-3 mb-4">
              <p className="text-sm font-semibold mb-0.5">Novedad de la semana</p>
              <p className="text-sm text-gray-300">{state.currentDecision.context}</p>
            </div>
            <div className="space-y-2">
              {state.currentDecision.options.map((opt, i) => (
                <Btn key={i} className="w-full" onClick={() => act((s) => ({ ...E.applyDecisionEffects(s, s.currentDecision, i), decisionUsed: true }))}>
                  {opt.text}
                </Btn>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Ya decidiste esta semana. Avanzá para ver qué pasa.</p>
        )}
      </Card>

      <Card>
        <Title icon={Landmark}>Objetivo de la directiva</Title>
        <p className="text-sm font-semibold">{objective.label}</p>
        <p className="text-xs text-gray-500 mt-1">
          Vas {pos}° de {state.leagueTable.length} · fuerza del equipo {Math.round(E.teamStrength(state))} · nivel medio del plantel {Math.round(E.squadAverage(state))}
        </p>
      </Card>

      <details className="group">
        <summary className="cursor-pointer list-none">
          <Card className="flex items-center gap-2 !py-3">
            <ListOrdered size={15} className="text-accent shrink-0" />
            <span className="font-semibold flex-1">Tabla de liga · vas {E.myLeaguePosition(state) || "—"}°</span>
            <span className="text-xs text-gray-500 group-open:hidden">Ver ▾</span>
            <span className="text-xs text-gray-500 hidden group-open:inline">Ocultar ▴</span>
          </Card>
        </summary>
        <div className="mt-3"><Liga state={state} /></div>
      </details>

      <Card>
        <Title icon={Users}>Novedades</Title>
        <div className="space-y-1.5">
          {state.news.map((n, i) => <p key={i} className="text-xs text-gray-500">{n}</p>)}
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Finanzas
function Finanzas({ state, act }) {
  const inc = E.weeklyIncome(state);
  const exp = E.weeklyExpenses(state);
  const net = inc.total - exp.total;
  const weeks = state.weeksPerSeason || E.WEEKS_PER_SEASON;
  const incRows = [
    ["Entradas", inc.tickets], ["Socios", inc.socios], ["Sponsors", inc.sponsors], ["TV", inc.tv],
    ["Tienda", inc.merch], ["Palcos VIP", inc.vip], ["Competencia intl.", inc.intl],
  ];
  const expRows = [["Sueldos", exp.sueldos], ["Mantenimiento", exp.mantenimiento], ["Intereses", exp.intereses]];
  const ledger = state.ledger;
  const last = state.lastLedger;

  return (
    <div className="space-y-5">
      <Card>
        <Title icon={Wallet}>Flujo semanal</Title>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ingresos · {perWeek(inc.total)}</p>
            {incRows.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-0.5"><span className="text-gray-400">{k}</span><span className="tabular-nums">{perWeek(v)}</span></div>
            ))}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Gastos · {perWeek(exp.total)}</p>
            {expRows.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-0.5"><span className="text-gray-400">{k}</span><span className="tabular-nums">{perWeek(v)}</span></div>
            ))}
            <div className={`mt-3 text-sm font-semibold ${net >= 0 ? "text-emerald" : "text-red-400"}`}>
              Resultado: {net >= 0 ? "+" : "−"}{perWeek(Math.abs(net))} (≈ {net >= 0 ? "+" : "−"}{money(Math.abs(net) * weeks)} por temporada)
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">Asistencia estimada: {inc.attendance.toLocaleString()} personas ({Math.round(inc.rate * 100)}% del estadio).</p>
      </Card>

      <Card>
        <Title icon={Coins}>Precio de la entrada</Title>
        <div className="flex flex-wrap gap-2">
          {E.TICKET_PRICE_LEVELS.map((p, i) => (
            <Btn key={p} tone={state.ticketPriceLevel === i + 1 ? "accent" : "default"} onClick={() => act(E.setTicketPrice, i + 1)}>€{p}</Btn>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Más caro: más plata por persona, pero menos asistencia y la hinchada lo siente.</p>
      </Card>

      <Card>
        <Title icon={Landmark}>Banco y deuda</Title>
        <p className="text-sm mb-3">
          Caja: <span className="font-semibold">{money(state.budget)}</span> · Deuda: <span className={`font-semibold ${state.debt > 0 ? "text-red-400" : ""}`}>{money(state.debt)}</span>
          <span className="text-gray-500"> (interés {state.debt > E.DEBT_CEILING ? "usurero" : "normal"}: {perWeek(exp.intereses)})</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {E.LOAN_OPTIONS.map((a) => (
            <Btn key={a} onClick={() => act(E.takeLoan, a)} disabled={state.debt + a > 120}>Pedir €{a}M</Btn>
          ))}
          <Btn tone="accent" onClick={() => act(E.repayDebt, 10)} disabled={state.debt <= 0 || state.budget < 1}>Pagar €10M</Btn>
          <Btn tone="accent" onClick={() => act(E.repayDebt, state.debt)} disabled={state.debt <= 0 || state.budget < 1}>Pagar todo lo que pueda</Btn>
        </div>
      </Card>

      <Card>
        <Title icon={Wallet}>Ingresos contra gastos por temporada</Title>
        <SeasonBars state={state} />
      </Card>

      <Card>
        <Title icon={Newspaper}>Libro contable</Title>
        {[["Temporada en curso", ledger], last && [`Temporada ${last.season} (cerrada)`, last]].filter(Boolean).map(([name, l]) => (
          <div key={name} className="mb-4 last:mb-0">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{name}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <div>
                {Object.entries(l.income).filter(([, v]) => v > 0.01).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs py-0.5"><span className="text-gray-500 capitalize">+ {k}</span><span className="tabular-nums text-emerald">{money(v)}</span></div>
                ))}
              </div>
              <div>
                {Object.entries(l.expense).filter(([, v]) => v > 0.01).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs py-0.5"><span className="text-gray-500 capitalize">− {k}</span><span className="tabular-nums text-red-400">{money(v)}</span></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------- Club
// Maqueta del estadio: una tribuna por nivel, dibujadas alrededor de la
// cancha en vez de solo decir "nivel 3".
function StadiumDrawing({ tier }) {
  const stands = [
    { d: "M14 22a54 26 0 0 1 92 0", opacity: tier >= 3 ? 1 : 0.15 },
    { d: "M8 38a52 24 0 0 1 104 0", opacity: tier >= 1 ? 1 : 0.15 },
    { d: "M8 38a52 24 0 0 0 104 0", opacity: tier >= 2 ? 1 : 0.15 },
    { d: "M2 30a58 30 0 0 1 20 -14", opacity: tier >= 4 ? 1 : 0.15 },
  ];
  return (
    <svg viewBox="0 0 120 70" className="w-full max-w-[220px] mx-auto" role="img" aria-label={"Estadio nivel " + tier}>
      <ellipse cx="60" cy="38" rx="52" ry="24" fill="rgb(var(--c-emerald) / 0.15)" stroke="rgb(var(--c-emerald) / 0.4)" />
      <rect x="36" y="26" width="48" height="24" fill="none" stroke="currentColor" strokeOpacity="0.3" />
      {stands.map((st, i) => (
        <path key={i} d={st.d} fill="none" stroke="rgb(var(--c-accent))" strokeWidth="5" strokeOpacity={st.opacity} />
      ))}
    </svg>
  );
}

function ClubInfra({ state, act }) {
  const nextStadium = E.STADIUM_TIERS[state.stadiumTier];
  return (
    <div className="space-y-5">
      <Card>
        <Title icon={Building2}>Estadio</Title>
        <StadiumDrawing tier={state.stadiumTier} />
        <p className="text-sm mb-3 text-center">Nivel {state.stadiumTier} · {E.STADIUM_TIERS[state.stadiumTier - 1].capacity.toLocaleString()} espectadores</p>
        <Btn tone="accent" onClick={() => act(E.upgradeStadium)} disabled={!nextStadium || !E.canUpgradeStadium(state)}>
          {nextStadium ? `Ampliar a ${nextStadium.capacity.toLocaleString()} — ${money(nextStadium.upgradeCost)}` : "Estadio al máximo"}
        </Btn>
        <p className="text-xs text-gray-500 mt-2">Un estadio más grande sube las entradas, la TV y habilita más sponsors (naming del estadio desde el nivel 2).</p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {E.INFRA.map((it) => {
          const cur = state[it.key] || 0;
          const next = it.tiers[cur];
          return (
            <Card key={it.key}>
              <Title icon={Building2} right={<span className="text-xs text-gray-500">Nivel {cur}/{it.tiers.length}</span>}>{it.label}</Title>
              <div className="flex gap-1.5 mb-3">
                {it.tiers.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < cur ? "bg-accent" : "bg-white/10"}`} />)}
              </div>
              {cur > 0 && <p className="text-xs text-gray-400 mb-2">Actual: {it.tiers[cur - 1].desc}</p>}
              {next ? (
                <Btn tone="accent" className="w-full" onClick={() => act(E.upgradeInfra, it.key)} disabled={!E.canUpgradeInfra(state, it.key)}>
                  Mejorar — {money(next.cost)}
                  <span className="block text-xs text-gray-500">{next.desc}</span>
                </Btn>
              ) : <p className="text-xs text-emerald">Al máximo ✅</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Comercial
function Comercial({ state, act }) {
  const tvNeeded = !state.tv || state.tv.seasonsLeft <= 0;
  return (
    <div className="space-y-5">
      <Card>
        <Title icon={Handshake}>Sponsors</Title>
        <div className="space-y-4">
          {E.SPONSOR_SLOTS.map((slot) => {
            const deal = state.sponsors?.[slot.key];
            const active = deal && deal.seasonsLeft > 0;
            const offers = (state.sponsorOffers || []).filter((o) => o.slot === slot.key);
            const locked = state.stadiumTier < slot.needsStadium;
            return (
              <div key={slot.key} className="rounded-card border border-border bg-bg p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold">{slot.label}</p>
                  {active && <span className="text-xs text-emerald">{deal.brand} · {perWeek(deal.weekly)} · {deal.seasonsLeft} temp.</span>}
                </div>
                {locked && <p className="text-xs text-gray-500">Se habilita con el estadio nivel {slot.needsStadium}.</p>}
                {!locked && active && <p className="text-xs text-gray-500">{deal.bonus ? `Bonus de ${money(deal.bonus)} si cumplís el objetivo. ` : ""}{deal.risky ? "⚠️ Marca polémica: puede salpicarte." : ""}</p>}
                {!locked && !active && offers.length === 0 && <p className="text-xs text-gray-500">Sin ofertas por ahora. Aparecen al cerrar la temporada.</p>}
                {!locked && !active && offers.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {offers.map((o) => (
                      <Btn key={o.id} onClick={() => act(E.signSponsor, o.id)}>
                        <p className="text-sm font-medium">{o.brand}</p>
                        <p className="text-xs text-gray-500">{perWeek(o.weekly)} · {o.seasons} temp. · bonus {money(o.bonus)}</p>
                        {o.risky && <p className="text-xs text-red-300">Paga más, pero es polémica</p>}
                      </Btn>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <Title icon={Tv}>Derechos de TV</Title>
        {!tvNeeded ? (
          <p className="text-sm">{state.tv.label}: {perWeek(state.tv.weekly)}{state.tv.bonusWeekly ? ` (+${perWeek(state.tv.bonusWeekly)} si estás en el top 4)` : ""} · {state.tv.seasonsLeft} temporada{state.tv.seasonsLeft > 1 ? "s" : ""} más.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {E.tvOptions(state).map((o) => (
              <Btn key={o.id} onClick={() => act(E.negotiateTv, o.id)}>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-xs text-gray-500">{perWeek(o.weekly)}{o.bonusWeekly ? ` + ${perWeek(o.bonusWeekly)} en el top 4` : ""} · {o.seasons} temp.</p>
                <p className="text-xs text-gray-500 mt-1">{o.desc}</p>
              </Btn>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------- Socios
function Socios({ state, act }) {
  const cap = E.membersCap(state);
  return (
    <div className="space-y-5">
      <Card>
        <Title icon={Heart}>Socios e hinchada</Title>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <div><p className="text-2xl font-bold tabular-nums">{state.members.toLocaleString()}</p><p className="text-xs text-gray-500">socios (tope {cap.toLocaleString()})</p></div>
          <Bar label="Hinchada" value={state.fanHappiness} />
          <Bar label="Prensa" value={state.press ?? 50} hint="La relación con los medios" />
        </div>
        <p className="text-sm font-medium mb-2">Cuota social</p>
        <div className="flex flex-wrap gap-2">
          {E.MEMBER_FEE_LEVELS.map((f, i) => (
            <Btn key={f.label} tone={state.memberFeeLevel === i + 1 ? "accent" : "default"} onClick={() => act(E.setMemberFee, i + 1)}>
              {f.label} · €{f.fee}/año
            </Btn>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Una cuota alta rinde más por socio pero frena el crecimiento de la masa societaria.</p>
      </Card>

      <Card>
        <Title icon={Megaphone}>Campañas</Title>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(E.CAMPAIGNS).map(([key, c]) => {
            const wait = Math.max(0, (state.cooldowns?.[key] || 0) - state.turn);
            return (
              <Btn key={key} onClick={() => act(E.runCampaign, key)} disabled={state.budget < c.cost || wait > 0}>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-gray-500">{money(c.cost)} · {c.desc}</p>
                {wait > 0 && <p className="text-xs text-amber mt-1">Disponible en {wait} sem.</p>}
              </Btn>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------- Plantel
const STATUS_LABEL = { watching: "En seguimiento", signed: "Fichado ✅", rejected: "Rechazado por el DT 🚫" };

function Plantel({ state, act }) {
  const squad = useMemo(() => [...state.squad].sort((a, b) => b.ovr - a.ovr), [state.squad]);
  const targets = state.transferTargets || [];
  const phil = E.PHILOSOPHIES[state.philosophy];
  const canChangePhil = !(state.philosophyChangedSeason === state.season && state.turn > 0);

  return (
    <div className="space-y-5">
      <Card>
        <Title icon={Crown}>Filosofía del club</Title>
        <p className="text-sm mb-3"><span className="font-semibold">{phil.icon} {phil.label}</span> — <span className="text-gray-400">{phil.desc}</span></p>
        <div className="flex flex-wrap gap-2 mb-2">
          {Object.entries(E.PHILOSOPHIES).map(([key, p]) => (
            <Btn key={key} tone={state.philosophy === key ? "accent" : "default"} disabled={!canChangePhil && state.philosophy !== key} onClick={() => act(E.setPhilosophy, key)}>
              {p.icon} {p.label}
            </Btn>
          ))}
        </div>
        <p className="text-xs text-gray-500">Cambiar de rumbo se puede una vez por temporada y cuesta confianza de la directiva.</p>

        <p className="text-sm font-medium mt-4 mb-2">Política salarial</p>
        <div className="flex flex-wrap gap-2">
          {E.WAGE_LEVELS.map((w) => (
            <Btn key={w.level} tone={state.wageLevel === w.level ? "accent" : "default"} onClick={() => act(E.setWageLevel, w.level)}>
              {w.label}<span className="block text-xs text-gray-500">sueldos ×{w.mult} · rendimiento {w.strength >= 0 ? "+" : ""}{w.strength}</span>
            </Btn>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Masa salarial actual: {perWeek(E.payroll(state))}.</p>
      </Card>

      <Card>
        <Title icon={UserPlus}>Director técnico</Title>
        {state.dtName ? (
          <div>
            <p className="text-sm font-medium">{state.dtName} <span className="text-xs text-gray-500">· {state.dtStyle} · contrato {state.dtContract} temp.</span></p>
            <div className="mt-3 max-w-xs"><Bar label="Tu confianza en el DT" value={state.dtConfidence} /></div>
            <div className="flex gap-2 mt-3">
              <Btn onClick={() => act(E.renewDt)} disabled={state.budget < 2 || state.dtContract >= 3}>Renovar 3 temp. — €2M</Btn>
              <Btn tone="danger" onClick={() => act(E.fireDt)}>Echar al DT</Btn>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-amber mb-3">El banco está vacío. Elegí a alguien para poder seguir.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {E.DT_CANDIDATES.map((c) => (
                <Btn key={c.id} onClick={() => act(E.hireDt, c.id)} disabled={state.budget < c.cost}>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.style} · {money(c.cost)} · nivel {c.quality}</p>
                </Btn>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <Title icon={Users} right={<span className="text-xs text-gray-500">Nivel medio {Math.round(E.squadAverage(state))}</span>}>Plantel ({squad.length})</Title>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-border">
                <th className="text-left py-1.5 font-medium">Jugador</th>
                <th className="text-center font-medium">Pos</th>
                <th className="text-center font-medium">Edad</th>
                <th className="text-center font-medium">OVR</th>
                <th className="text-center font-medium">Pot.</th>
                <th className="text-center font-medium">Contrato</th>
                <th className="text-right font-medium">Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-2 truncate max-w-[140px]">{p.name}{p.injured > 0 && <span className="text-red-400"> 🩹{p.injured}s</span>}</td>
                  <td className="text-center text-gray-400">{p.pos}</td>
                  <td className="text-center tabular-nums">{p.age}</td>
                  <td className="text-center tabular-nums font-semibold">{p.ovr}</td>
                  <td className="text-center tabular-nums text-gray-500">{p.pot}</td>
                  <td className={`text-center tabular-nums ${p.contract <= 1 ? "text-amber font-semibold" : "text-gray-400"}`}>{p.contract} a.</td>
                  <td className="text-right tabular-nums">{money(E.playerValue(p))}</td>
                  <td className="text-right whitespace-nowrap pl-2">
                    <button onClick={() => act(E.renewPlayer, p.id)} disabled={state.budget < Math.max(0.3, p.wage * 20)} className="text-accent disabled:opacity-30 mr-2">Renovar</button>
                    <button onClick={() => act(E.sellPlayer, p.id)} disabled={squad.length <= 14} className="text-red-300 disabled:opacity-30">Vender</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">Renovar cuesta una prima (20 semanas de sueldo) y sube el sueldo 10%. Los contratos que vencen se van a fin de temporada: el DT repone con jugadores del nivel base del club.</p>
      </Card>

      <Card>
        <Title icon={Search} right={<button onClick={() => act(E.scoutTarget)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-accent/30 text-accent hover:bg-accent/10">Buscar nombre</button>}>
          Fichajes en mira
        </Title>
        {targets.length === 0 ? (
          <p className="text-xs text-gray-500">Todavía no mandaste a los ojeadores a buscar nada.</p>
        ) : (
          <div className="space-y-2">
            {targets.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-card border border-border bg-bg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name} <span className="text-xs text-gray-500">· {t.position} · {t.age} años · nivel {t.ovr}</span></p>
                  <p className="text-xs text-gray-500">{money(t.cost)} · {STATUS_LABEL[t.status]}{t.priority && t.status === "watching" ? " · prioridad" : ""}</p>
                </div>
                {t.status === "watching" && !t.priority && (
                  <button onClick={() => act(E.markTargetPriority, t.id)} className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-amber/30 text-amber hover:bg-amber/10">Marcar prioridad</button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-3">Al marcarlo como prioridad, el DT lo evalúa la semana siguiente: puede ficharlo, esperar por presupuesto o rechazarlo (y eso te cuesta confianza en él).</p>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------------- Directiva
function Directiva({ state, act }) {
  const vote = E.projectedVote(state);
  const toElection = E.seasonsToElection(state);
  return (
    <div className="space-y-5">
      <Card>
        <Title icon={Vote}>Elecciones</Title>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: vote >= 50 ? "rgb(var(--c-emerald))" : "rgb(var(--c-red))" }}>{vote}%</p>
            <p className="text-xs text-gray-500">apoyo proyectado (necesitás 50%)</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{toElection === 1 ? "Este año" : `${toElection} temp.`}</p>
            <p className="text-xs text-gray-500">para las próximas elecciones</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{state.opposition.name}</p>
            <p className="text-xs text-gray-500">Candidato opositor · fuerza {state.opposition.strength}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">El voto sale de la confianza de la directiva, la hinchada, la prensa, los títulos, el objetivo cumplido y los favores que juntes. Reelecciones ganadas: {state.electionsWon}.</p>
      </Card>

      <Card>
        <Title icon={Gavel}>Directiva</Title>
        <div className="mb-4 max-w-xs"><Bar label="Confianza general" value={state.boardTrust} /></div>
        <div className="space-y-3">
          {state.board.map((m) => {
            const loyalty = E.boardLoyalty(state, m);
            const wait = Math.max(0, 6 - (state.turn - m.lastLobby));
            return (
              <div key={m.id} className="rounded-card border border-border bg-bg p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium">{m.name} <span className="text-xs text-gray-500">· {m.role}</span></p>
                    <p className="text-xs text-gray-500">Le importa: {m.wants}{m.favor > 0 ? ` · favor +${m.favor}` : ""}</p>
                  </div>
                  <div className="w-32"><Bar label="Lealtad" value={loyalty} /></div>
                  <Btn onClick={() => act(E.lobbyMember, m.id)} disabled={state.budget < 0.6 || wait > 0}>
                    Cenar (€0.6M){wait > 0 && <span className="block text-xs text-gray-500">en {wait} sem.</span>}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3">Si tres miembros pierden la confianza del todo (lealtad menor a 20), presentan una moción de censura y te destituyen.</p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------ Liga
function Liga({ state }) {
  const sorted = E.sortedLeagueTable(state.leagueTable || []);
  const objective = E.objectiveFor(state.teamId);
  const next = state.fixtures?.[state.week]?.find(([h, a]) => h === state.teamId || a === state.teamId);
  const opp = next ? teamById(next[0] === state.teamId ? next[1] : next[0]) : null;
  return (
    <Card>
      <Title icon={ListOrdered} right={<span className="text-xs text-gray-500">Fecha {state.week}/{state.weeksPerSeason}</span>}>Tabla de posiciones</Title>
      <p className="text-xs text-gray-500 mb-3">
        Objetivo: <span className="text-gray-300">{objective.label}</span>
        {opp && <> · Próximo rival: <span className="text-gray-300">{opp.name}{opp.id === state.rivalId ? " 🔥" : ""} ({next[0] === state.teamId ? "local" : "visitante"})</span></>}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-border">
              <th className="text-left py-1.5 font-medium">#</th><th className="text-left font-medium">Club</th>
              <th className="text-center font-medium">PJ</th><th className="text-center font-medium">DG</th><th className="text-center font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.id} className={`border-b border-border/50 ${row.id === state.teamId ? "bg-accent/10" : ""}`}>
                <td className="py-1.5 tabular-nums">{i + 1}°</td>
                <td className={`truncate max-w-[160px] ${row.id === state.teamId ? "font-semibold text-accent" : ""}`}>{row.name}{row.id === state.rivalId && " 🔥"}</td>
                <td className="text-center tabular-nums text-gray-400">{row.pj}</td>
                <td className="text-center tabular-nums text-gray-400">{row.gf - row.gc}</td>
                <td className="text-center tabular-nums font-semibold">{row.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------- Legado
function Legado({ state, onRetire }) {
  const { activeGroupId: groupId } = useGroups();
  const [confirm, setConfirm] = useState(false);
  const legacy = buildPresidenteLegacy(state);
  const have = new Set(state.achievements || []);
  return (
    <div className="space-y-5">
      <Card>
        <Title icon={Award} right={<span className="text-xs text-gray-500">{legacy.achievements}/{legacy.achievementsTotal}</span>}>Logros</Title>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {E.ACHIEVEMENTS.map((a) => (
            <div key={a.id} className={`rounded-card border px-3 py-2 ${have.has(a.id) ? "border-amber/40 bg-amber/5" : "border-border opacity-60"}`}>
              <p className="text-sm font-medium">{have.has(a.id) ? "🏅" : "🔒"} {a.label}</p>
              <p className="text-xs text-gray-500">{a.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Title icon={Trophy}>Historial de gestión ({state.history.length})</Title>
        {state.history.length === 0 && <p className="text-xs text-gray-500">Todavía no cerraste ninguna temporada.</p>}
        <div className="space-y-2">
          {state.history.map((h, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-card border border-border bg-bg px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Temporada {h.season}</p>
                <p className="text-xs text-gray-500">{h.objectiveLabel} — {h.objectiveMet ? "cumplido" : "no cumplido"}{h.qualifiesInternational && " · 🌍 internacional"}{h.income != null && ` · ingresos ${money(h.income)}, gastos ${money(h.expense)}`}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{h.position}°{h.champion && " 🏆"}</p>
                <p className="text-xs text-gray-500">de {h.leagueSize}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Title icon={Landmark}>Tu legado</Title>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
          <div><p className="text-2xl font-bold">{legacy.seasonsCount}</p><p className="text-xs text-gray-500">Temporadas</p></div>
          <div><p className="text-2xl font-bold text-amber">{legacy.titlesWon}</p><p className="text-xs text-gray-500">Títulos</p></div>
          <div><p className="text-2xl font-bold text-emerald">{legacy.electionsWon}</p><p className="text-xs text-gray-500">Elecciones ganadas</p></div>
          <div><p className="text-2xl font-bold">{Math.round(legacy.prestige)}</p><p className="text-xs text-gray-500">Prestigio</p></div>
        </div>
        {groupId && <p className="text-xs text-gray-500 mb-3">Puntaje de legado: <span className="text-white font-semibold">{legacy.legacyScore}</span> — se sube al ranking histórico del grupo al renunciar.</p>}
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="text-sm font-semibold px-4 py-2.5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">Renunciar y cerrar la gestión</button>
        ) : (
          <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
            <p className="text-sm mb-3">Esto borra tu gestión para siempre. No se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => onRetire(legacy)} className="text-sm font-semibold px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white">Sí, renunciar</button>
              <button onClick={() => setConfirm(false)} className="text-sm text-gray-400 hover:text-white">Cancelar</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ contenedor
const TABS = [
  { key: "club", label: "Club", icon: Building2 },
  { key: "dinero", label: "Dinero", icon: Wallet },
  { key: "gente", label: "Gente", icon: Users },
  { key: "futbol", label: "Fútbol", icon: Crown },
];

const GAME_OVER_TEXT = {
  destituido: "La directiva perdió la confianza en tu gestión.",
  mocion: "Tres miembros de la directiva te destituyeron con una moción de censura.",
  elecciones: "Los socios eligieron a otro presidente en las urnas.",
};

function Dashboard({ state, setState, onExit }) {
  const team = teamById(state.teamId);
  const { activeGroupId: groupId } = useGroups();
  const [tab, setTab] = useState("club");
  const { toast } = useToast();

  // Aplica una acción pura del motor sobre el estado más reciente.
  const act = (fn, ...args) => {
    // Acciones que se pueden deshacer: se guarda el estado de antes.
    const undoable = { [E.sellPlayer.name]: "Jugador vendido", [E.fireDt.name]: "DT despedido" }[fn.name];
    if (undoable) {
      const next = fn(state, ...args);
      if (next !== state) { setState(next); toast(undoable, { undo: () => setState(state) }); }
      return;
    }
    setState((s) => fn(s, ...args));
  };

  const retire = async (legacy) => {
    if (groupId) {
      try {
        await api.post("/challenges/submit", { gameKey: "presidente_legado", groupId, score: legacy.legacyScore });
      } catch {
        /* si falla el submit, igual dejamos renunciar */
      }
    }
    onExit();
  };

  if (state.gameOver) {
    const legacy = buildPresidenteLegacy(state);
    return (
      <Card>
        <div className="text-center py-8">
          <ShieldX size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-xl font-bold mb-2">{state.gameOverReason === "elecciones" ? "Perdiste las elecciones" : "Destituido"}</p>
          <p className="text-gray-400 mb-2">{GAME_OVER_TEXT[state.gameOverReason] || GAME_OVER_TEXT.destituido}</p>
          <p className="text-sm text-gray-500 mb-6">
            {legacy.seasonsCount} temporadas · {legacy.titlesWon} títulos · {legacy.achievements} logros · puntaje de legado {legacy.legacyScore}
          </p>
          <button onClick={() => retire(legacy)} className="btn btn-primary">Cerrar y empezar de nuevo</button>
        </div>
      </Card>
    );
  }

  const weeksPerSeason = state.weeksPerSeason || E.WEEKS_PER_SEASON;
  const pos = E.myLeaguePosition(state);

  return (
    <div className="space-y-5">
      <div className="sticky top-[57px] lg:top-2 z-20">
        <Card className="!py-3 !px-4 shadow-lg">
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <TeamCrest team={team} size={36} />
              <div className="min-w-0">
                <p className="font-bold truncate">{team.name}</p>
                <p className="text-xs text-gray-500">Temp. {state.season} · Fecha {state.week}/{weeksPerSeason}{state.week > 0 ? ` · ${pos}°` : ""} · {E.PHILOSOPHIES[state.philosophy].icon} {E.PHILOSOPHIES[state.philosophy].label}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Sparkline values={state.cashHistory || []} />
              <div className="text-right">
                <p className="flex items-center gap-1.5 text-sm font-semibold justify-end"><Coins size={15} className="text-accent" />{money(state.budget)}</p>
                <p className={`text-xs ${state.debt > 0 ? "text-bad" : "text-gray-500"}`}>deuda {money(state.debt)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3">
            <Bar label="Directiva" value={state.boardTrust} hint="Confianza de la directiva" />
            <Bar label="Hinchada" value={state.fanHappiness} />
            <Bar label="Prensa" value={state.press ?? 50} />
            <Bar label="Prestigio" value={state.prestige} hint="La marca del club" />
          </div>
        </Card>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-card text-xs font-medium border transition-colors ${
              tab === t.key ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "club" && (
        <div className="space-y-10">
          <Section title="Despacho"><Despacho state={state} act={act} /></Section>
          <Section title="Estadio e infraestructura"><ClubInfra state={state} act={act} /></Section>
          <Section title="Legado y logros"><Legado state={state} onRetire={retire} /></Section>
        </div>
      )}
      {tab === "dinero" && (
        <div className="space-y-10">
          <Section title="Finanzas"><Finanzas state={state} act={act} /></Section>
          <Section title="Sponsors y TV"><Comercial state={state} act={act} /></Section>
        </div>
      )}
      {tab === "gente" && (
        <div className="space-y-10">
          <Section title="Socios, hinchada y prensa"><Socios state={state} act={act} /></Section>
          <Section title="Directiva y elecciones"><Directiva state={state} act={act} /></Section>
        </div>
      )}
      {tab === "futbol" && <Plantel state={state} act={act} />}

      <button
        onClick={() => act(E.advanceWeek)}
        disabled={!state.dtName}
        className="btn btn-primary w-full sticky bottom-3"
      >
        {!state.dtName ? "Elegí un DT (Fútbol) para seguir" : state.week >= weeksPerSeason - 1 ? "Cerrar temporada →" : "Avanzar semana →"}
      </button>
    </div>
  );
}

export default function Presidente() {
  const [state, setState] = useState(() => load());

  useEffect(() => {
    if (state) save(state);
  }, [state]);

  const exit = () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* nada que borrar */ }
    setState(null);
  };

  const startCareer = (team, philosophy) => {
    setState(E.initialPresidentState(team.id, team.name, team.league, team.prestige, philosophy));
  };

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
            <Heart size={22} className="text-accent" />
            Modo Presidente
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            No dirigís la cancha: manejás el club. Caja, estadio, sponsors, socios, prensa, contratos y una directiva que te puede echar (o reelegir cada cuatro años).
          </p>
        </div>
        {state && !state.gameOver && (
          <button onClick={exit} className="text-xs text-gray-500 hover:text-red-400 transition-colors border border-border rounded-full px-3 py-1.5">
            Abandonar y empezar de nuevo
          </button>
        )}
      </div>

      {!state && <ClubPicker onStart={startCareer} />}
      {state && <Dashboard state={state} setState={setState} onExit={exit} />}
    </Layout>
  );
}
