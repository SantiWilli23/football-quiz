import { createContext } from "react";

// La carcasa de un juego fusionado le pasa a `Layout` los chips de variantes para que se vean
// arriba de la pantalla del juego (y desaparezcan solos en modo enfoque, mientras se juega).
export const ShellContext = createContext(null);
