// Sonidos y vibración cortos para aciertos, errores y victorias. Se generan con
// WebAudio (sin archivos) y se apagan desde Perfil → Apariencia. Todo va en
// try/catch: sin audio, sin vibración o sin storage, el juego sigue igual.
const KEY = "fq_sfx";
let ctx = null;

export function isSfxOn() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setSfxOn(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* sin storage */ }
}

const TONES = {
  ok: [[660, 0.09], [880, 0.12]],
  bad: [[220, 0.16]],
  win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.2]],
  tick: [[440, 0.04]],
};
const VIBES = { ok: 25, bad: [40, 40, 40], win: [30, 40, 30, 40, 80], tick: 8 };

export function playSfx(kind) {
  if (!isSfxOn()) return;
  try {
    if (navigator.vibrate) navigator.vibrate(VIBES[kind] || 0);
  } catch { /* sin vibración */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, dur] of TONES[kind] || []) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "bad" ? "sawtooth" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur * 0.9;
    }
  } catch { /* sin audio */ }
}

// ---- Silbato, gol y ambiente de estadio (Futotal 2.0) ----
// Todo sintetizado, sin archivos. El silbato y el gol suenan siempre (con vibración);
// el ambiente de estadio solo en partidos temáticos y se apaga con el mismo silenciador.
function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = ctx || new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noiseBuffer(c, seconds) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Pitazo: dos tonos agudos cercanos con temblor, como un silbato de árbitro.
export function playWhistle(long = false) {
  if (!isSfxOn()) return;
  try { navigator.vibrate?.(long ? [60, 40, 120] : 60); } catch { /* sin vibración */ }
  try {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    const dur = long ? 0.9 : 0.45;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.03);
    gain.gain.setValueAtTime(0.07, t + dur - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const trem = c.createOscillator();
    const tremGain = c.createGain();
    trem.frequency.value = 38;
    tremGain.gain.value = 0.03;
    trem.connect(tremGain).connect(gain.gain);
    gain.connect(c.destination);
    for (const f of [2870, 3130]) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(gain);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    trem.start(t);
    trem.stop(t + dur + 0.02);
  } catch { /* sin audio */ }
}

// Gol: rugido de tribuna (ruido filtrado que sube y baja) más un acorde corto.
export function playGoal() {
  if (!isSfxOn()) return;
  try { navigator.vibrate?.([30, 40, 30, 40, 90]); } catch { /* sin vibración */ }
  try {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 1.4);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(500, t);
    band.frequency.exponentialRampToValueAtTime(1500, t + 0.5);
    band.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    src.connect(band).connect(g).connect(c.destination);
    src.start(t);
    src.stop(t + 1.4);
    let at = t + 0.05;
    for (const f of [523, 659, 784]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      og.gain.setValueAtTime(0.0001, at);
      og.gain.exponentialRampToValueAtTime(0.06, at + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      o.connect(og).connect(c.destination);
      o.start(at);
      o.stop(at + 0.4);
      at += 0.08;
    }
  } catch { /* sin audio */ }
}

// Ambiente de estadio: murmullo continuo y bajo. Devuelve la función que lo detiene.
export function startAmbience() {
  if (!isSfxOn()) return () => {};
  try {
    const c = audio();
    if (!c) return () => {};
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 4);
    src.loop = true;
    const low = c.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 420;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.035, c.currentTime + 1.2);
    // La «ola» de la hinchada: el volumen sube y baja despacio.
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.18;
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(low).connect(g).connect(c.destination);
    src.start();
    lfo.start();
    return () => {
      try {
        g.gain.cancelScheduledValues(c.currentTime);
        g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
        src.stop(c.currentTime + 0.6);
        lfo.stop(c.currentTime + 0.6);
      } catch { /* ya detenido */ }
    };
  } catch { return () => {}; }
}
