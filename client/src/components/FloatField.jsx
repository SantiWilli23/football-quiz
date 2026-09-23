import { useId } from "react";

// Campo con la etiqueta adentro que sube al escribir o enfocar: una sola
// línea de alto y sin repetir el texto como rótulo y como placeholder.
export default function FloatField({ label, type = "text", value, onChange, autoComplete }) {
  const id = useId();
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder=" "
        className="peer w-full bg-bg border border-border rounded-card px-4 pt-5 pb-1.5 text-sm focus:outline-none focus:border-accent transition-colors"
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-1.5 text-xs text-gray-500 transition-all pointer-events-none
          peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm
          peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-accent"
      >
        {label}
      </label>
    </div>
  );
}
