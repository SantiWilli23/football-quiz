// "Tipo de juego": el rol táctico real, más allá de la posición genérica de
// la base (que solo distingue Portero/Defensa/Mediocampista/Delantero). Dos
// mediocampistas de la misma nacionalidad no son igual de parecidos si uno
// es un pivote defensivo y el otro un mediapunta creativo — Rodri se parece
// mucho más a Busquets que a Pedri, aunque los tres sean mediocampistas
// españoles. Esto solo cubre jugadores conocidos a mano (no hay dato de rol
// en la base): el resto simplemente no suma ni resta por esto, no se
// inventa un rol al voleo para no ensuciar el puntaje con una etiqueta
// inventada.
export const STYLES = {
  portero: "Portero",
  central: "Defensor central",
  lateral: "Lateral / carrilero",
  pivote: "Pivote defensivo",
  organizador: "Organizador / motor de juego",
  mediapunta: "Mediapunta creativo",
  extremo: "Extremo desequilibrante",
  killer: "Killer de área",
  falso9: "Falso 9 / segunda punta",
};

const CURATED = {
  // Porteros
  "Thibaut Courtois": "portero", "Alisson": "portero", "Ederson": "portero",
  "Marc-André ter Stegen": "portero", "Manuel Neuer": "portero",
  "Gianluigi Donnarumma": "portero", "Jan Oblak": "portero", "Mike Maignan": "portero",
  "Emiliano Martínez": "portero",

  // Centrales
  "Virgil van Dijk": "central", "Rúben Dias": "central", "William Saliba": "central",
  "Éder Militão": "central", "Antonio Rüdiger": "central", "Josko Gvardiol": "central",
  "Marquinhos": "central", "Sergio Ramos": "central", "Gerard Pique": "central",

  // Laterales / carrileros
  "Trent Alexander-Arnold": "lateral", "Achraf Hakimi": "lateral",
  "Alphonso Davies": "lateral", "João Cancelo": "lateral", "Kyle Walker": "lateral",
  "Jordi Alba": "lateral", "Theo Hernández": "lateral",

  // Pivotes defensivos: el ejemplo del pedido — Rodri y Busquets acá, Pedri no.
  "Rodri": "pivote", "Sergio Busquets": "pivote", "Casemiro": "pivote",
  "Fabinho": "pivote", "N'Golo Kanté": "pivote", "Manuel Ugarte": "pivote",
  "Martín Zubimendi": "pivote", "Declan Rice": "pivote", "Moisés Caicedo": "pivote",
  "Aurélien Tchouaméni": "pivote", "Marcelo Brozovic": "pivote", "Javier Mascherano": "pivote",

  // Organizadores: manejan el ritmo desde una posición más retrasada.
  "Pedri": "organizador", "Toni Kroos": "organizador", "Luka Modric": "organizador",
  "Kevin De Bruyne": "organizador", "Joshua Kimmich": "organizador",
  "Thiago Alcântara": "organizador", "Marco Verratti": "organizador",
  "Frenkie de Jong": "organizador", "Xavi Hernández": "organizador",

  // Mediapuntas creativos: más cerca del área rival, menos de la salida.
  "Bruno Fernandes": "mediapunta", "Martin Ødegaard": "mediapunta",
  "James Rodríguez": "mediapunta", "Jude Bellingham": "mediapunta",
  "Christian Eriksen": "mediapunta", "Philippe Coutinho": "mediapunta",
  "Isco": "mediapunta", "Dani Olmo": "mediapunta", "Florian Wirtz": "mediapunta",
  "Andrés Iniesta": "mediapunta",

  // Extremos desequilibrantes
  "Vinícius Júnior": "extremo", "Lamine Yamal": "extremo", "Mohamed Salah": "extremo",
  "Rafael Leão": "extremo", "Bukayo Saka": "extremo", "Jeremy Doku": "extremo",
  "Nico Williams": "extremo", "Raheem Sterling": "extremo", "Ousmane Dembélé": "extremo",
  "Neymar": "extremo",

  // Killers de área: definidores puros
  "Robert Lewandowski": "killer", "Erling Haaland": "killer", "Harry Kane": "killer",
  "Victor Osimhen": "killer", "Alvaro Morata": "killer", "Romelu Lukaku": "killer",
  "Dušan Vlahović": "killer", "Cristiano Ronaldo": "killer",

  // Falsos 9 / segunda punta: caen a buscar el juego en vez de vivir en el área.
  "Lionel Messi": "falso9", "Roberto Firmino": "falso9", "Antoine Griezmann": "falso9",
  "Karim Benzema": "falso9",
};

export function styleOf(player) {
  return CURATED[player?.nombre] || null;
}

export function styleLabel(key) {
  return key ? STYLES[key] || null : null;
}
