import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Layout from "../components/Layout.jsx";

// Elegir cómo jugar antes de entrar al primer juego: una tarjeta grande por opción.
export default function Picker({ eyebrow = "Jugar", title, subtitle, items, color = "var(--c-accent)" }) {
  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <p className="t-eyebrow">{eyebrow}</p>
          <h1 className="t-title">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
        </div>
        <div className={`grid gap-3 ${items.length > 2 ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
          {items.map((it) => {
            const inner = (
              <>
                <span className="flex items-start justify-between gap-2">
                  <b className="block" style={{ font: "800 22px var(--f-d, inherit)" }}>{it.label}</b>
                  <ChevronRight size={20} className="mt-1 shrink-0 text-gray-500" />
                </span>
                {it.hint && <span className="mt-1.5 block text-sm text-gray-400">{it.hint}</span>}
                {it.tag && <span className="mt-3 inline-block rounded-full border border-border px-2 py-0.5 text-[11px] text-gray-400">{it.tag}</span>}
              </>
            );
            const cls = "p-card block w-full text-left transition-colors hover:border-accent";
            const style = { borderTop: `3px solid ${it.color || color}` };
            return it.to
              ? <Link key={it.label} to={it.to} className={cls} style={style}>{inner}</Link>
              : <button key={it.label} type="button" onClick={it.onClick} className={cls} style={style}>{inner}</button>;
          })}
        </div>
      </div>
    </Layout>
  );
}
