// Lista de cambios de la Demo. El número es el de la lista que armó el dueño; el panel de abajo
// (DemoBar) los muestra, el contador sale de aquí y cada uno se puede copiar para pasarlo a la
// versión actual. Un cambio solo se agrega a esta lista cuando ya está implementado en la Demo.
export const CAMBIOS = [];
export const add = (c) => { CAMBIOS.push(c); CAMBIOS.sort((a, b) => String(a.n).localeCompare(String(b.n), "es", { numeric: true })); };
