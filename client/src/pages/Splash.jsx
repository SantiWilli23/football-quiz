import { Link } from "react-router-dom";

export default function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-white px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-card bg-gradient-to-br from-accent-light to-emerald-500 flex items-center justify-center text-black font-extrabold text-xl">
            FT
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-accent-light via-accent to-emerald-500 bg-clip-text text-transparent">
            FUTOTAL
          </h1>
          <p className="text-gray-400 max-w-sm text-sm">
            La trivia de fútbol que desafía a los que lo saben todo
          </p>
        </div>

        <div className="flex flex-col items-center gap-5 mt-8">
          <div className="w-16 h-px bg-border" />
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Trivia diaria
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Duelos
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Grupos
            </span>
          </div>
          <Link
            to="/panel"
            className="rounded-full bg-gradient-to-r from-accent to-accent-light px-8 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
          >
            Jugar ahora
          </Link>
        </div>

        <p className="text-[11px] text-gray-600 tracking-wide mt-8">
          COTRERO · DRAFT EUROPEO 8A2 · TRIVIA
        </p>
      </div>
    </div>
  );
}
