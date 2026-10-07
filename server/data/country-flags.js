// Bandera (emoji) de cada nacionalidad tal como está escrita en
// equipo-jugador-players.json. Inglaterra, Escocia y Gales usan las banderas
// de subdivisión; Irlanda del Norte no tiene emoji propio y usa la británica.
const ISO = {
  Albania: "AL", Alemania: "DE", Angola: "AO", "Arabia Saudita": "SA", Argelia: "DZ", Argentina: "AR",
  Armenia: "AM", Australia: "AU", Austria: "AT", "Bosnia y Herzegovina": "BA", Brasil: "BR", Bulgaria: "BG",
  "Burkina Faso": "BF", Bélgica: "BE", "Cabo Verde": "CV", Camerún: "CM", Canadá: "CA", Chile: "CL",
  China: "CN", Colombia: "CO", Congo: "CG", "Corea del Sur": "KR", "Costa Rica": "CR", "Costa de Marfil": "CI",
  Croacia: "HR", Dinamarca: "DK", Ecuador: "EC", Egipto: "EG", Eslovaquia: "SK", Eslovenia: "SI",
  España: "ES", "Estados Unidos": "US", Estonia: "EE", Finlandia: "FI", Francia: "FR", Gabon: "GA",
  Gabón: "GA", Gambia: "GM", Georgia: "GE", Ghana: "GH", Grecia: "GR", Guinea: "GN", "Guinea-Bisáu": "GW",
  Hungría: "HU", Irlanda: "IE", "Irlanda del Norte": "GB", Irán: "IR", Islandia: "IS", Israel: "IL",
  Italia: "IT", Jamaica: "JM", Japón: "JP", Kenia: "KE", Kosovo: "XK", Liberia: "LR", Luxemburgo: "LU",
  "Macedonia del Norte": "MK", Mali: "ML", Marruecos: "MA", Montenegro: "ME", Mozambique: "MZ", México: "MX",
  Nigeria: "NG", Noruega: "NO", "Nueva Zelanda": "NZ", Paraguay: "PY", "Países Bajos": "NL", Perú: "PE",
  Polonia: "PL", Portugal: "PT", "RD Congo": "CD", "República Checa": "CZ", "República Dominicana": "DO",
  Rumania: "RO", Rusia: "RU", Senegal: "SN", Serbia: "RS", "Sierra Leona": "SL", Suecia: "SE", Suiza: "CH",
  Surinam: "SR", Togo: "TG", Turquía: "TR", Túnez: "TN", Ucrania: "UA", Uruguay: "UY", Uzbekistán: "UZ",
  Venezuela: "VE",
};

const SUBDIVISION = {
  Inglaterra: "gbeng",
  Escocia: "gbsct",
  Gales: "gbwls",
};

function tagFlag(code) {
  return "\u{1F3F4}" + [...code].map((ch) => String.fromCodePoint(0xe0000 + ch.charCodeAt(0))).join("") + "\u{E007F}";
}

export function flagOf(country) {
  if (SUBDIVISION[country]) return tagFlag(SUBDIVISION[country]);
  const iso = ISO[country];
  if (!iso) return "🏳️";
  return [...iso].map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)).join("");
}
