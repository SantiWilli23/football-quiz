import { useCareer } from "../context/CareerContext.jsx";
import { weeklyWageBill } from "../engine/financeEngine.js";

export default function Finances() {
  const { state, team } = useCareer();

  const weeklyWages = weeklyWageBill(state.squad); // €k/semana
  const annualWagesM = Math.round((weeklyWages * 52) / 1000 * 10) / 10; // €M/año
  const income = state.lastSeasonIncome;

  const feesSpent = (state.sentOffers || [])
    .filter((o) => o.type === "fee" && o.accepted && !o.byClause)
    .reduce((sum, o) => sum + o.amount, 0);
  const feesSpentClause = (state.sentOffers || [])
    .filter((o) => o.type === "fee" && o.accepted && o.byClause)
    .reduce((sum, o) => sum + o.amount, 0);
  const totalSpent = Math.round((feesSpent + feesSpentClause) * 20) / 20;

  const topEarners = [...state.squad].sort((a, b) => b.wage - a.wage).slice(0, 8);
  const wageShareOfBudget = state.budget > 0 ? Math.min(100, Math.round((annualWagesM / (state.budget + annualWagesM)) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold mb-1">Finanzas</h2>
        <p className="text-sm text-gray-500">Panorama económico de {team.name} — temporada {state.season}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Presupuesto de fichajes</p>
          <p className="text-3xl font-bold text-accent leading-none">€{state.budget}M</p>
          <p className="text-xs text-gray-500 mt-2">Disponible para ofertas y sueldos nuevos</p>
        </div>
        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Masa salarial semanal</p>
          <p className="text-3xl font-bold leading-none">€{weeklyWages}k</p>
          <p className="text-xs text-gray-500 mt-2">≈ €{annualWagesM}M al año</p>
        </div>
        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Gastado en fichajes</p>
          <p className="text-3xl font-bold leading-none">€{totalSpent}M</p>
          <p className="text-xs text-gray-500 mt-2">Acumulado en esta carrera{feesSpentClause > 0 ? ` (€${feesSpentClause}M por cláusulas)` : ""}</p>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Sueldos vs. presupuesto</p>
        <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${wageShareOfBudget}%`, background: wageShareOfBudget >= 65 ? "#d9534f" : wageShareOfBudget >= 40 ? "#d9a441" : "#3fae9a" }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Los sueldos representan el {wageShareOfBudget}% de tu capacidad económica anual.
          {wageShareOfBudget >= 65 && <span className="text-red-400"> Estás muy comprometido — pensalo dos veces antes de fichar.</span>}
        </p>
      </div>

      <div className="bg-panel border border-border rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Ingresos de la última temporada</p>
        {income ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold">€{income.tvMoney}M</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Derechos de TV</p>
            </div>
            <div>
              <p className="text-lg font-bold">€{income.taquilla}M</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Taquilla</p>
            </div>
            <div>
              <p className="text-lg font-bold">€{income.premio}M</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Premios</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Todavía no se cerró ninguna temporada — los ingresos se calculan y suman al presupuesto al final de cada una.</p>
        )}
      </div>

      <div className="bg-panel border border-border rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Sueldos más altos del plantel</p>
        <div className="space-y-1.5">
          {topEarners.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-300 truncate">{p.name}</span>
              <span className="text-gray-500 tabular-nums shrink-0 ml-3">€{p.wage}k/sem</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
