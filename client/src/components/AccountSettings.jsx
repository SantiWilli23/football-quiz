import { useState } from "react";
import api from "../api.js";
import Card from "./Card.jsx";

const inputClass =
  "w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent";

export default function AccountSettings({ user, onUpdated }) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [nameError, setNameError] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");

  const saveUsername = async (e) => {
    e.preventDefault();
    setNameError("");
    setNameMsg("");
    setNameBusy(true);
    try {
      await api.put("/auth/username", { username });
      setNameMsg("Nombre actualizado.");
      onUpdated();
    } catch (err) {
      setNameError(err.response?.data?.error || "No se pudo cambiar el nombre");
    } finally {
      setNameBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPassError("");
    setPassMsg("");

    if (next !== repeat) {
      setPassError("Las dos contraseñas nuevas no coinciden");
      return;
    }

    setPassBusy(true);
    try {
      await api.put("/auth/password", { current_password: current, new_password: next });
      setPassMsg("Contraseña actualizada.");
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (err) {
      setPassError(err.response?.data?.error || "No se pudo cambiar la contraseña");
    } finally {
      setPassBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold mb-5">Mi cuenta</h2>

      <form onSubmit={saveUsername} className="mb-8">
        <label className="block text-xs text-gray-500 mb-2">Nombre de usuario</label>
        <div className="flex gap-2 flex-wrap">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            className={`${inputClass} flex-1 min-w-[180px]`}
          />
          <button
            type="submit"
            disabled={nameBusy || username.trim() === user?.username}
            className="bg-accent hover:bg-accent-dark disabled:opacity-40 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors shrink-0"
          >
            {nameBusy ? "Guardando..." : "Cambiar"}
          </button>
        </div>
        {nameError && <p className="text-sm text-red-400 mt-2">{nameError}</p>}
        {nameMsg && <p className="text-sm text-accent mt-2">{nameMsg}</p>}
      </form>

      <form onSubmit={savePassword}>
        <label className="block text-xs text-gray-500 mb-2">Cambiar contraseña</label>
        <div className="space-y-2 max-w-sm">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Contraseña actual"
            autoComplete="current-password"
            className={inputClass}
          />
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Contraseña nueva"
            autoComplete="new-password"
            className={inputClass}
          />
          <input
            type="password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            placeholder="Repetir la nueva"
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
        {passError && <p className="text-sm text-red-400 mt-2">{passError}</p>}
        {passMsg && <p className="text-sm text-accent mt-2">{passMsg}</p>}
        <button
          type="submit"
          disabled={passBusy || !current || !next || !repeat}
          className="mt-3 bg-accent hover:bg-accent-dark disabled:opacity-40 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
        >
          {passBusy ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </Card>
  );
}
