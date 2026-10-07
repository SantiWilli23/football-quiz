// Puzzles de la Pirámide: 10 jugadores y una estadística comparable. Solo se
// usan cifras CERRADAS (jugadores retirados de esa competencia o récords de
// una temporada ya terminada), para que el dato no quede viejo con el tiempo.
// Ojo al sumar puzzles: nada de jugadores en actividad en esa competencia.
// Empates permitidos: el juego acepta cualquier orden entre empatados.
export const PYRAMID_PUZZLES = [
  {
    key: "mundiales",
    category: "Goles en Mundiales",
    unit: "goles",
    entries: [
      ["Miroslav Klose", 16], ["Ronaldo Nazário", 15], ["Gerd Müller", 14], ["Just Fontaine", 13],
      ["Pelé", 12], ["Sándor Kocsis", 11], ["Jürgen Klinsmann", 11], ["Gary Lineker", 10],
      ["Gabriel Batistuta", 10], ["Eusébio", 9],
    ],
  },
  {
    key: "balon-de-oro",
    category: "Balones de Oro ganados (hasta 2025)",
    unit: "Balones de Oro",
    entries: [
      ["Lionel Messi", 8], ["Cristiano Ronaldo", 5], ["Michel Platini", 3], ["Johan Cruyff", 3],
      ["Marco van Basten", 3], ["Franz Beckenbauer", 2], ["Ronaldo Nazário", 2], ["Alfredo Di Stéfano", 2],
      ["Zinedine Zidane", 1], ["Luka Modrić", 1],
    ],
  },
  {
    key: "premier",
    category: "Goles en la Premier League",
    unit: "goles",
    entries: [
      ["Alan Shearer", 260], ["Wayne Rooney", 208], ["Andy Cole", 187], ["Sergio Agüero", 184],
      ["Frank Lampard", 177], ["Thierry Henry", 175], ["Robbie Fowler", 163], ["Jermain Defoe", 162],
      ["Michael Owen", 150], ["Les Ferdinand", 149],
    ],
  },
  {
    key: "champions",
    category: "Goles en Champions League / Copa de Europa",
    unit: "goles",
    entries: [
      ["Cristiano Ronaldo", 140], ["Lionel Messi", 129], ["Karim Benzema", 90], ["Raúl", 71],
      ["Ruud van Nistelrooy", 56], ["Thierry Henry", 50], ["Alfredo Di Stéfano", 49], ["Andriy Shevchenko", 48],
      ["Zlatan Ibrahimović", 48], ["Didier Drogba", 44],
    ],
  },
  {
    key: "laliga",
    category: "Goles en LaLiga",
    unit: "goles",
    entries: [
      ["Lionel Messi", 474], ["Cristiano Ronaldo", 311], ["Telmo Zarra", 251], ["Karim Benzema", 238],
      ["Hugo Sánchez", 234], ["Raúl", 228], ["Alfredo Di Stéfano", 227], ["César Rodríguez", 221],
      ["Quini", 219], ["Pahiño", 210],
    ],
  },
  {
    key: "serie-a",
    category: "Goles en la Serie A",
    unit: "goles",
    entries: [
      ["Silvio Piola", 274], ["Francesco Totti", 250], ["Gunnar Nordahl", 225], ["Giuseppe Meazza", 216],
      ["José Altafini", 216], ["Antonio Di Natale", 209], ["Roberto Baggio", 205], ["Kurt Hamrin", 190],
      ["Giuseppe Signori", 188], ["Alessandro Del Piero", 188],
    ],
  },
  {
    key: "bundesliga",
    category: "Goles en la Bundesliga",
    unit: "goles",
    entries: [
      ["Gerd Müller", 365], ["Robert Lewandowski", 312], ["Klaus Fischer", 268], ["Jupp Heynckes", 220],
      ["Manfred Burgsmüller", 213], ["Ulf Kirsten", 182], ["Stefan Kuntz", 179], ["Dieter Müller", 177],
      ["Klaus Allofs", 177], ["Hannes Löhr", 166],
    ],
  },
  {
    key: "seleccion",
    category: "Goles con su selección",
    unit: "goles",
    entries: [
      ["Ali Daei", 108], ["Ferenc Puskás", 84], ["Pelé", 77], ["Sándor Kocsis", 75],
      ["Miroslav Klose", 71], ["Gerd Müller", 68], ["Ronaldo Nazário", 62], ["David Villa", 59],
      ["Romário", 55], ["Wayne Rooney", 53],
    ],
  },
  {
    key: "temporada",
    category: "Goles en una temporada de liga",
    unit: "goles",
    entries: [
      ["Lionel Messi", 50, "LaLiga 2011/12"], ["Cristiano Ronaldo", 48, "LaLiga 2014/15"],
      ["Robert Lewandowski", 41, "Bundesliga 2020/21"], ["Gerd Müller", 40, "Bundesliga 1971/72"],
      ["Luis Suárez", 40, "LaLiga 2015/16"], ["Hugo Sánchez", 38, "LaLiga 1989/90"],
      ["Erling Haaland", 36, "Premier 2022/23"], ["Gonzalo Higuaín", 36, "Serie A 2015/16"],
      ["Ciro Immobile", 36, "Serie A 2019/20"], ["Alan Shearer", 34, "Premier 1994/95"],
    ],
  },
].map((p) => ({
  ...p,
  entries: p.entries.map(([name, value, detail], i) => ({ id: `${p.key}-${i}`, name, value, detail: detail || null })),
}));
