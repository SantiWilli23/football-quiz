import { createContext, useCallback, useContext, useState } from "react";

// Avisos chicos abajo que confirman lo que acabás de hacer (guardar una marca,
// subir de puesto, sumar racha). Máximo 3 a la vez, se van solos.
const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const toast = useCallback((message) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(92vw,360px)] pointer-events-none"
        aria-live="polite"
      >
        {items.map((t) => (
          <div key={t.id} className="toast-in flex items-center gap-2.5 bg-panel border border-border rounded-card px-4 py-2.5 text-sm shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
