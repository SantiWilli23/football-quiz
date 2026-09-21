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
