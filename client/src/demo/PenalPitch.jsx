// Cancha del penal para la Demo: el arco con red, el portero, el punto penal y el balón. Se adapta
// al ancho del teléfono y del computador (el dibujo escala; la pregunta va debajo).
// estado: "idle" (antes de elegir), "gol" (la pelota entra y el portero se tira al otro lado) o
// "atajado" (el portero llega a la pelota).
export default function PenalPitch({ estado = "idle" }) {
  const gol = estado === "gol";
  const atajado = estado === "atajado";
  const keeper = gol ? "translate(58px, 6px) rotate(24deg)" : atajado ? "translate(40px, 4px) rotate(18deg)" : "translate(0, 0)";
  const ball = gol ? "translate(-52px, -118px) scale(.55)" : atajado ? "translate(52px, -104px) scale(.6)" : "translate(0, 0)";
  const t = "transform .55s cubic-bezier(.2,.8,.2,1)";
  return (
    <svg viewBox="0 0 320 190" className="mx-auto block w-full max-w-[460px]" role="img" aria-label={gol ? "Gol" : atajado ? "Atajado" : "Penal: el balón en el punto penal frente al arco"}>
      <defs>
        <pattern id="pp-net" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0L8 8M8 0L0 8" stroke="rgba(233,242,237,.28)" strokeWidth=".8" /></pattern>
        <linearGradient id="pp-grass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0f2b1f" /><stop offset="1" stopColor="#14392a" /></linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="190" rx="18" fill="url(#pp-grass)" />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={i * 54} y="62" width="27" height="128" fill="rgba(255,255,255,.035)" />)}
      <path d="M40 190 L60 62 H260 L280 190" fill="none" stroke="rgba(233,242,237,.35)" strokeWidth="2" />
      <rect x="86" y="22" width="148" height="62" fill="url(#pp-net)" stroke="#e9f2ed" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="160" cy="150" r="2.5" fill="#e9f2ed" opacity=".7" />
      <g style={{ transform: keeper, transformOrigin: "160px 78px", transition: t }}>
        <circle cx="160" cy="48" r="7" fill="#f2b84b" />
        <rect x="150" y="55" width="20" height="26" rx="6" fill="#f2b84b" />
        <path d="M150 60 L136 72 M170 60 L184 72" stroke="#f2b84b" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g style={{ transform: ball, transformOrigin: "160px 150px", transition: t }}>
        <circle cx="160" cy="150" r="11" fill="#f4f7f5" stroke="#111" strokeWidth="2" />
        <path d="M160 143 L166 148 L164 155 L156 155 L154 148Z" fill="#111" />
      </g>
      {gol && <text x="160" y="116" textAnchor="middle" fontSize="30" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#2fb673" letterSpacing="3">¡GOL!</text>}
      {atajado && <text x="160" y="116" textAnchor="middle" fontSize="26" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#ef5b5b" letterSpacing="2">ATAJADO</text>}
    </svg>
  );
}
