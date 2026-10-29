import { Coins } from "lucide-react";
import PlayerFace, { ClubCrest } from "../components/PlayerFace.jsx";

// Carta de la Demo: marco por rareza, cara grande, media, escudo y un brillo que sigue al puntero.
const SELL_VALUE = { estrella: 120, oro: 40, plata: 15, bronce: 5 };

function shine(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 100;
  const y = ((e.clientY - r.top) / r.height) * 100;
  e.currentTarget.style.setProperty("--mx", `${x}%`);
  e.currentTarget.style.setProperty("--my", `${y}%`);
}

export default function FigCard({ c, selected, onClick, small = false, onSell, back = false }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} onPointerMove={shine}
      className={`fig fig-${c.tier} ${small ? "fig-s" : ""} ${selected ? "fig-sel" : ""} ${back ? "fig-back" : ""}`}
      aria-label={back ? "Carta boca abajo" : `${c.realName || c.name}, ${c.ovr}, ${c.tierLabel}`}>
      {back ? <span className="fig-logo">FT</span> : (
        <>
          <span className="fig-top">
            <b className="fig-ovr">{c.ovr}</b>
            <i className="fig-pos">{c.pos}</i>
            {c.club && <ClubCrest name={c.club} size={small ? 18 : 24} />}
          </span>
          <span className="fig-face"><PlayerFace name={c.realName || c.name} size={small ? 58 : 92} /></span>
          <span className="fig-name">{c.realName || c.name}</span>
          <span className="fig-meta">{c.tierLabel}{c.count > 1 ? ` · ×${c.count}` : ""}</span>
          {c.special && <span className="fig-tag">{c.special}</span>}
          {c.isNew && <span className="fig-new">¡NUEVA!</span>}
          {c.form && <span className="fig-form">+{c.ovrBonus}</span>}
          {onSell && (
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onSell(c); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSell(c); } }}
              title={`Vender por ${SELL_VALUE[c.tier]} monedas`} className="fig-sell"><Coins size={10} /> {SELL_VALUE[c.tier]}</span>
          )}
        </>
      )}
    </Tag>
  );
}
