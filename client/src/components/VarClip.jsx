import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, VolumeX } from "lucide-react";

// Clip real de YouTube recortado a [start, end], siempre en silencio: el
// audio original dice la decisión del VAR. Sin controles de YouTube
// (controls=0, disablekb=1) y con una capa transparente encima, así no hay
// forma de activar el sonido ni de saltar al resto del video; los controles
// son propios y solo recorren el tramo de la jugada.
let apiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

const SPEEDS = [1, 0.5, 0.25];

// Los subtítulos automáticos transcriben la narración, que dice la decisión.
function silence(p) {
  try {
    p.mute();
    p.unloadModule?.("captions");
    p.unloadModule?.("cc");
  } catch { /* el reproductor todavía no está listo */ }
}

export default function VarClip({ video }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [t, setT] = useState(video.start);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setFailed(false);
    setT(video.start);
    setSpeed(1);
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const el = document.createElement("div");
      hostRef.current.replaceChildren(el);
      playerRef.current = new YT.Player(el, {
        videoId: video.id,
        width: "100%",
        height: "100%",
        playerVars: {
          start: video.start,
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          cc_load_policy: 0,
          cc_lang_pref: "xx",
        },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            silence(e.target);
            e.target.seekTo(video.start, true);
            e.target.playVideo();
            setReady(true);
          },
          onStateChange: (e) => {
            silence(e.target);
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
            if (e.data === YT.PlayerState.PAUSED) setPlaying(false);
            if (e.data === YT.PlayerState.ENDED) {
              e.target.seekTo(video.start, true);
              e.target.pauseVideo();
              setPlaying(false);
            }
          },
          onError: () => !cancelled && setFailed(true),
        },
      });
    }).catch(() => setFailed(true));
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* ya destruido */ }
      playerRef.current = null;
    };
  }, [video.id, video.start, video.end]);

  // Refuerzo del silencio + posición para la línea de tiempo.
  useEffect(() => {
    if (!ready) return;
    const iv = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      if (!p.isMuted?.() || p.getOption?.("captions", "track")?.languageCode) silence(p);
      const now = p.getCurrentTime();
      if (now >= video.end || now < video.start - 1) {
        p.pauseVideo();
        p.seekTo(video.start, true);
      }
      setT(Math.max(video.start, Math.min(video.end, now)));
    }, 200);
    return () => clearInterval(iv);
  }, [ready, video.start, video.end]);

  function toggle() {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }
  function restart() {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(video.start, true);
    p.playVideo();
  }
  function changeSpeed(s) {
    setSpeed(s);
    playerRef.current?.setPlaybackRate?.(s);
  }
  function seek(v) {
    playerRef.current?.seekTo(v, true);
    setT(v);
  }

  const btn = "p-2 rounded-card border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40";

  return (
    <div className="mb-4 -mx-6 -mt-6 card-bleed">
      <div className="relative bg-black rounded-t-2xl overflow-hidden aspect-video">
        <div ref={hostRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
        {/* Capa que bloquea cualquier interacción con el reproductor de YouTube;
            en pausa además tapa la pantalla de "Más videos" de YouTube. */}
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={toggle} aria-hidden="true">
          {ready && !playing && (
            <>
              <div className="absolute inset-x-0 top-0 h-[16%] bg-black" />
              <div className="absolute inset-x-0 bottom-0 h-[22%] bg-black" />
              <span className="relative w-16 h-16 rounded-full bg-black border border-white/30 flex items-center justify-center text-white">
                <Play size={26} />
              </span>
            </>
          )}
        </div>
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/70 text-[10px] font-semibold tracking-wider text-white pointer-events-none">
          <span className={`w-1.5 h-1.5 rounded-full ${playing ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
          VAR · CLIP REAL
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white pointer-events-none">
          <VolumeX size={11} /> sin sonido
        </div>
        {!ready && !failed && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">Cargando clip…</div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 px-6 text-center">
            No se pudo cargar el clip. Revisá tu conexión o que YouTube no esté bloqueado.
          </div>
        )}
      </div>

      <div className="px-6 pt-3 space-y-2">
        <input
          type="range"
          min={video.start}
          max={video.end}
          step="0.1"
          value={t}
          disabled={!ready}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Línea de tiempo del clip"
          className="w-full accent-[rgb(var(--c-accent))]"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={toggle} disabled={!ready} className={btn} aria-label={playing ? "Pausar" : "Reproducir"}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button onClick={restart} disabled={!ready} className={btn} aria-label="Repetir la jugada"><RotateCcw size={15} /></button>
          <span className="text-xs text-gray-500 tabular-nums">{(t - video.start).toFixed(1)}s / {video.end - video.start}s</span>
          <div className="ml-auto flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => changeSpeed(s)}
                disabled={!ready}
                className={`px-2 py-1 rounded-card text-xs font-medium border transition-colors ${speed === s ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}
              >
                x{s}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-600">Clip: Professional Referee Organization (PRO) · MLS 2026</p>
      </div>
    </div>
  );
}
