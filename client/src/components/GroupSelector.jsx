import { Users } from "lucide-react";
import { useGroups } from "../context/GroupContext.jsx";

// Sólo aparece si hay más de un grupo: con uno solo el selector sería ruido.
export default function GroupSelector({ className = "" }) {
  const { groups, activeGroupId, selectGroup } = useGroups();

  if (groups.length < 2) return null;

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <Users size={14} className="text-gray-500 shrink-0" />
      <span className="sr-only">Grupo activo</span>
      <select
        value={activeGroupId ?? ""}
        onChange={(e) => selectGroup(Number(e.target.value))}
        className="bg-panel border border-border rounded-card px-3 py-1.5 text-sm focus:outline-none focus:border-accent max-w-[180px]"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}
