import { Link } from "react-router-dom";
import { Wordmark } from "./Shell.jsx";

// Portada (Futotal 2.0), igual que el prototipo: la pelota que rebota, la marca y un solo
// botón. Se juega un partido de práctica antes de registrarse; recién al terminar se pide la cuenta.
export default function Portada() {
  return (
    <div className="p-porta">
      <div className="p-ballw" aria-hidden="true"><i className="p-ball" /><i className="p-bsh" /></div>
      <h1><Wordmark className="p-wm" /></h1>
      <p className="p-tagl">Un partido nuevo cada día. Juega con tus amigos.</p>
      <Link to="/practica" className="p-btn big">Jugar ahora</Link>
      <Link to="/login" className="p-link">Ya tengo cuenta</Link>
    </div>
  );
}
