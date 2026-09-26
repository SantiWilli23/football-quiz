// Vida FUT tiene sus propias partidas, separadas de las que jugás suelto: un
// Cotrero, una Carrera DT o un Presidente abiertos desde Vida FUT llevan
// ?vidafut=1 en la URL y guardan todo con el prefijo "vidafut_". Así jugar un
// Cotrero normal no avanza (ni pisa) la campaña, y viceversa.
export const VIDAFUT_PREFIX = "vidafut_";

export function isVidaFut() {
  try {
    return new URLSearchParams(window.location.search).get("vidafut") === "1";
  } catch {
    return false;
  }
}

// Se resuelve en cada llamada (no al importar el módulo): la app es una SPA y
// se puede pasar de un modo suelto al de Vida FUT sin recargar la página.
export function vfKey(key, on = isVidaFut()) {
  return on ? `${VIDAFUT_PREFIX}${key}` : key;
}
