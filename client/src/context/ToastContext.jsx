import { createContext, useCallback, useContext, useState } from "react";

// Avisos chicos que confirman lo que acabás de hacer (guardar una marca, subir
// de puesto, sumar racha). Arriba en el móvil (abajo tapaban la barra de
// navegación) y abajo en escritorio. Máximo 3 a la vez y se van solos.
// `toast(mensaje, { undo })`: si se pasa `undo`, el aviso ofrece «Deshacer»
// durante 5 segundos y lo ejecuta al tocarlo.
const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const toast = useCallback((message, opts = {}) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, message, undo: opts.undo }]);
    setTimeout(() => dismiss(id), opts.undo ? 5000 : 3500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed top-16 lg:top-auto lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(92vw,360px)] pointer-events-none"
        aria-live="polite"
      >
        {items.map((t) => (
          <div key={t.id} className="toast-in pointer-events-auto flex items-center gap-2.5 bg-panel border border-border rounded-card px-4 py-2.5 text-sm shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="flex-1">{t.message}</span>
            {t.undo && (
              <button
                onClick={() => { t.undo(); dismiss(t.id); }}
                className="text-accent font-semibold text-sm hover:underline shrink-0"
              >
                Deshacer
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
