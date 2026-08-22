import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api.js";
import { useAuth } from "./AuthContext.jsx";

const GroupContext = createContext(null);
const STORAGE_KEY = "fq_active_group";

// Antes cada página hacía su propio GET /groups y se quedaba con groups[0], así
// que si estabas en dos grupos sólo veías el primero y nunca podías cambiar.
// Acá se cargan una sola vez y el grupo elegido se comparte entre todas las
// páginas, recordado entre sesiones.
export function GroupProvider({ children }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setActiveGroupId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/groups");
      setGroups(data.groups);

      const stored = Number(localStorage.getItem(STORAGE_KEY));
      // Si el grupo guardado ya no existe (te fuiste, o cambiaste de cuenta)
      // se cae al primero en vez de dejar la app apuntando a la nada, y se
      // reescribe lo guardado para no arrastrar un id muerto.
      const valid = data.groups.some((g) => g.id === stored);
      const next = valid ? stored : data.groups[0]?.id ?? null;
      setActiveGroupId(next);
      if (!valid) {
        if (next) localStorage.setItem(STORAGE_KEY, String(next));
        else localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      setGroups([]);
      setActiveGroupId(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const selectGroup = useCallback((id) => {
    setActiveGroupId(id);
    if (id) localStorage.setItem(STORAGE_KEY, String(id));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  return (
    <GroupContext.Provider
      value={{ groups, activeGroupId, activeGroup, selectGroup, loading, reloadGroups: loadGroups }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroups() {
  return useContext(GroupContext);
}
