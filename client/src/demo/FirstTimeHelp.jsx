import { useState } from "react";
import { GraduationCap, X } from "lucide-react";
import { tutorialFor } from "../tutorial/steps.js";
import TutorialPlayer from "../tutorial/TutorialPlayer.jsx";
import { helpPathOf } from "./helpPath.js";

const seenKey = (path) => `fq_tut_visto:${path}`;
const wasSeen = (path) => { try { return localStorage.getItem(seenKey(path)) === "1"; } catch { return true; } };
const markSeen = (path) => { try { localStorage.setItem(seenKey(path), "1"); } catch { /* sin storage */ } };

// Primera vez en un juego: se ofrece el tutorial solo, con un botón grande. Después queda el «?»
// de siempre arriba para repetirlo cuando se quiera.
export default function FirstTimeHelp({ pathname }) {
  const path = helpPathOf(pathname);
  const tutorial = tutorialFor(path);
  const [show, setShow] = useState(() => !!tutorial && !wasSeen(path));
  const [playing, setPlaying] = useState(false);
  if (!tutorial || (!show && !playing)) return null;
  const close = () => { markSeen(path); setShow(false); setPlaying(false); };
  return (
    <>
      {show && !playing && (
        <div role="dialog" aria-label="Primera vez" className="fixed inset-x-3 bottom-[88px] lg:bottom-6 lg:left-auto lg:right-6 lg:w-96 z-[60] rounded-2xl border border-accent/60 bg-panel p-4 shadow-2xl">
          <button type="button" onClick={close} aria-label="Ya sé jugar" className="absolute right-2 top-2 p-1 text-gray-400"><X size={16} /></button>
          <p className="flex items-center gap-2 font-bold"><GraduationCap size={18} className="text-accent" /> ¿Primera vez aquí?</p>
          <p className="mt-1 text-sm text-gray-400">Te explico cómo se juega en menos de un minuto.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPlaying(true)} className="btn btn-primary flex-1">Ver cómo se juega</button>
            <button type="button" onClick={close} className="btn btn-secondary">Ya sé</button>
          </div>
        </div>
      )}
      {playing && <TutorialPlayer title={tutorial.title} steps={tutorial.steps} onClose={close} />}
    </>
  );
}
