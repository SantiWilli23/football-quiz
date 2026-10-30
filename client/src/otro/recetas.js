// Alquimia de fútbol: elementos de partida y recetas. Cada receta junta dos elementos (en cualquier orden).
// Se parte con cuatro elementos básicos y todo lo demás se descubre combinando.
export const INICIALES = [
  { n: "Agua", e: "💧" },
  { n: "Fuego", e: "🔥" },
  { n: "Tierra", e: "🌍" },
  { n: "Viento", e: "💨" },
];

const key = (a, b) => [a, b].sort().join("|");
const R = new Map();
const add = (a, b, n, e) => { const k = key(a, b); if (!R.has(k)) R.set(k, { n, e }); };

// 1) Núcleo escrito a mano: «A+B=Nombre|emoji».
const NUCLEO = `
Agua+Fuego=Vapor|☁️
Agua+Tierra=Barro|🟤
Fuego+Tierra=Lava|🌋
Viento+Tierra=Polvo|🌫️
Agua+Viento=Ola|🌊
Fuego+Viento=Humo|🌬️
Agua+Agua=Lago|🏞️
Tierra+Tierra=Montaña|⛰️
Fuego+Fuego=Incendio|🔥
Viento+Viento=Tormenta|⛈️
Vapor+Tierra=Nube|☁️
Nube+Nube=Cielo|🌤️
Nube+Agua=Lluvia|🌧️
Lluvia+Tierra=Planta|🌱
Planta+Planta=Pasto|🌿
Pasto+Pasto=Cancha|🏟️
Lava+Agua=Piedra|🪨
Piedra+Fuego=Metal|⚙️
Metal+Metal=Acero|🔩
Metal+Fuego=Espada|🗡️
Barro+Fuego=Ladrillo|🧱
Ladrillo+Ladrillo=Muro|🧱
Muro+Muro=Estadio|🏟️
Planta+Fuego=Ceniza|⚫
Planta+Agua=Árbol|🌳
Árbol+Árbol=Bosque|🌲
Árbol+Metal=Madera|🪵
Madera+Madera=Poste|🥅
Poste+Poste=Arco|🥅
Arco+Pasto=Cancha|🏟️
Vapor+Agua=Lluvia|🌧️
Planta+Tierra=Pasto|🌿
Pasto+Viento=Pelota|⚽
Planta+Metal=Madera|🪵
Madera+Tierra=Poste|🥅
Madera+Poste=Arco|🥅
Viento+Cancha=Pelota|⚽
Pelota+Pasto=Pase|↗️
Pelota+Arco=Gol|🥅
Pelota+Pelota=Entrenamiento|🏃
Gol+Gol=Hat-trick|🎩
Gol+Fuego=Golazo|💥
Gol+Cancha=Partido|⚽
Partido+Partido=Torneo|🏆
Torneo+Torneo=Liga|📅
Torneo+Metal=Copa|🏆
Copa+Copa=Campeón|👑
Campeón+Estadio=Leyenda|⭐
Estadio+Gol=Hinchada|📣
Hinchada+Hinchada=Barra|🥁
Hinchada+Fuego=Bengala|🎇
Estadio+Lluvia=Barro|🟤
Estadio+Estadio=Ciudad|🏙️
Pase+Pase=Jugada|🧩
Jugada+Gol=Asistencia|🎯
Entrenamiento+Pasto=Jugador|🧍
Jugador+Jugador=Equipo|👥
Equipo+Equipo=Club|🛡️
Club+Torneo=Clásico|🔥
Club+Metal=Escudo|🛡️
Jugador+Pelota=Delantero|🏃
Jugador+Arco=Arquero|🧤
Jugador+Estadio=Capitán|©️
Jugador+Entrenamiento=Técnico|📋
Técnico+Equipo=Táctica|📐
Técnico+Fuego=Reclamo|😠
Reclamo+Jugador=Tarjeta|🟨
Tarjeta+Tarjeta=Roja|🟥
Jugador+Tarjeta=Árbitro|🧑‍⚖️
Árbitro+Tecnología=VAR|📺
Metal+Rayo=Tecnología|💻
Tormenta+Fuego=Rayo|⚡
Delantero+Gol=Goleador|🔝
Goleador+Copa=Bota de Oro|👟
Campeón+Leyenda=Historia|📖
Hinchada+Campeón=Fiesta|🎉
Fiesta+Fiesta=Carnaval|🎊
Cielo+Estadio=Luces|💡
Luces+Partido=Noche de copa|🌙
Equipo+Bandera=Selección|🌐
Viento+Escudo=Bandera|🚩
Escudo+Jugador=Camiseta|👕
Jugador+Muro=Defensa|🛡️
Jugador+Pase=Mediocampista|🧠
Jugador+Viento=Extremo|💨
Jugador+Poste=Lateral|↔️
Copa+Selección=Mundial|🌎
Mundial+Montaña=Copa América|🏆
Mundial+Ciudad=Eurocopa|🇪🇺
Copa+Noche de copa=Champions League|⭐
Copa+Montaña=Libertadores|⛰️
Pelota+Partido=Fútbol|⚽
Árbitro+Pase=Falta|🚫
Falta+Pelota=Tiro libre|🎯
Muro+Falta=Barrera|🧱
Falta+Arco=Penal|🥅
Pelota+Poste=Córner|🚩
Pelota+Lateral=Saque de banda|🤾
Árbitro+Delantero=Fuera de juego|🚷
Entrenamiento+Metal=Reloj|⏱️
Partido+Reloj=Prórroga|⏳
Reloj+Árbitro=Descuento|⌛
Penal+Penal=Tanda de penales|🥅
Gol+Reloj=Remontada|📈
Partido+Copa=Final|🏁
Final+Torneo=Semifinal|🥈
Torneo+Equipo=Grupo|👥
Torneo+Penal=Eliminatoria|⚔️
Bota de Oro+Pelota=Balón de Oro|🏅
Arquero+Copa=Guante de Oro|🧤
Copa+Piedra=Trofeo|🏆
Metal+Campeón=Medalla|🥇
Historia+Gol=Récord|📊
Mundial+Club=Mundial de Clubes|🌐
Copa+Estadio=Supercopa|🏆
Liga+Montaña=Ascenso|⬆️
Liga+Lluvia=Descenso|⬇️
Liga+Barro=Segunda División|🥈
Jugador+Metal=Fichaje|✍️
Fichaje+Ciudad=Transferencia|🔁
Fichaje+Fuego=Millones|💰
Fichaje+Muro=Cláusula|📄
Jugador+Planta=Cantera|🌱
Cantera+Partido=Debut|🎬
Leyenda+Lluvia=Retiro|👋
Leyenda+Fiesta=Homenaje|🎖️
Leyenda+Piedra=Estatua|🗿
Historia+Estadio=Museo|🏛️
Jugador+Madera=Banco|🪑
Banco+Jugador=Suplente|🔄
Roja+Jugador=Expulsado|🚶
Jugador+Barro=Lesión|🩹
Lesión+Madera=Camilla|🚑
Lesión+Técnico=Médico|⚕️
Lesión+Entrenamiento=Rehabilitación|💪
Jugador+Ola=Gambeta|🕺
Gambeta+Poste=Túnel|🚇
Gambeta+Cielo=Sombrero|🎩
Gambeta+Viento=Rabona|🌀
Gambeta+Montaña=Chilena|🤸
Pelota+Cielo=Cabezazo|🤕
Pelota+Rayo=Volea|⚡
Pelota+Espada=Tijera|✂️
Pase+Muro=Pared|🧱
Táctica+Rayo=Contraataque|⚡
Táctica+Fuego=Pressing|🔥
Táctica+Pase=Tiki-taka|🔄
Táctica+Muro=Catenaccio|🔒
Táctica+Ola=Fútbol total|🌊
Táctica+Cancha=4-4-2|📐
Táctica+Delantero=4-3-3|📐
Táctica+Lateral=3-5-2|📐
Defensa+Defensa=Línea de cuatro|🛡️
Arquero+Lluvia=Guantes|🧤
Arquero+Pelota=Atajada|🙌
Atajada+Penal=Penal atajado|🧤
Arquero+Muro=Valla invicta|🔒
Córner+Bandera=Banderín|🚩
Árbitro+Viento=Silbato|📯
Agua+Arco=Red|🥅
Pasto+Lluvia=Césped mojado|💦
Pasto+Metal=Césped sintético|🟩
Estadio+Madera=Palco|🛋️
Estadio+Ladrillo=Tribuna|🏟️
Tribuna+Barra=Popular|📣
Hinchada+Bandera=Banderazo|🚩
Hinchada+Viento=Canto|🎶
Tribuna+Bandera=Tifo|🎨
Canto+Estadio=Himno|🎵
Bengala+Cielo=Pirotecnia|🎆
Hinchada+Jugador=Hincha|🙋
Tecnología+Viento=Radio|📻
Tecnología+Luces=Televisión|📺
Radio+Jugador=Comentarista|🎙️
Radio+Gol=Narrador|📢
Radio+Historia=Periodista|📰
Periodista+Ciudad=Prensa|🗞️
Prensa+Técnico=Conferencia|🎤
Prensa+Fuego=Polémica|💢
Tecnología+Fiesta=Memes|😂
Televisión+Partido=Transmisión|📡
Transmisión+Reloj=Repetición|🔁
Jugador+Historia=Figurita|🃏
Figurita+Figurita=Álbum|📒
Tecnología+Partido=Videojuego|🎮
Videojuego+Equipo=Fantasy|🧮
Hat-trick+Hat-trick=Póker de goles|4️⃣
Golazo+Historia=Gol del siglo|✨
Goleador+Goleador=Pichichi|🔝
Capitán+Copa=Alzar la copa|🙌
Campeón+Campeón=Bicampeón|🏆
Bicampeón+Campeón=Tricampeón|🏆
Campeón+Liga=Invicto|🛡️
Entrenamiento+Técnico=Pretemporada|🏋️
Entrenamiento+Estadio=Concentración|🏨
Concentración+Jugador=Convocatoria|📋
Táctica+Jugador=Posesión|🎛️
Árbitro+Árbitro=Terna arbitral|👥
Árbitro+Estadio=Juez de línea|🚩
Selección+Entrenamiento=Amistoso|🤝
Selección+Torneo=Eliminatorias|🛣️
Selección+Partido=Clasificación|✅
`;
NUCLEO.trim().split("\n").forEach((l) => {
  const [lhs, rhs] = l.split("=");
  const [a, b] = lhs.split("+");
  const [n, e] = rhs.split("|");
  add(a, b, n, e);
});

// 2) Países: «Selección + cosa típica» da el país. Las cosas típicas salen de combinar
// elementos básicos (se reparten en orden entre las parejas libres).
const PAISES = [
  ["Argentina", "Tango"], ["Brasil", "Samba"], ["Chile", "Cueca"], ["Uruguay", "Mate"], ["Colombia", "Café"],
  ["México", "Taco"], ["Estados Unidos", "Hamburguesa"], ["Perú", "Ceviche"], ["Ecuador", "Banano"], ["Paraguay", "Tereré"],
  ["Venezuela", "Arepa"], ["Bolivia", "Altiplano"], ["España", "Flamenco"], ["Francia", "Baguette"], ["Alemania", "Cerveza"],
  ["Italia", "Pizza"], ["Inglaterra", "Té"], ["Portugal", "Fado"], ["Países Bajos", "Tulipán"], ["Bélgica", "Chocolate"],
  ["Croacia", "Damero"], ["Suiza", "Queso"], ["Dinamarca", "Sirenita"], ["Suecia", "Aurora"], ["Polonia", "Pierogi"],
  ["Turquía", "Kebab"], ["Escocia", "Gaita"], ["Gales", "Dragón"], ["Serbia", "Ajvar"], ["Grecia", "Olivo"],
  ["Japón", "Sushi"], ["Corea del Sur", "Kimchi"], ["Arabia Saudita", "Petróleo"], ["Marruecos", "Cuscús"], ["Senegal", "Baobab"],
  ["Egipto", "Pirámide"], ["Camerún", "Cacao"], ["Nigeria", "Afrobeat"], ["Ghana", "Oro"], ["Costa de Marfil", "Elefante"],
  ["Australia", "Canguro"],
];
const POOL = ["Vapor", "Barro", "Lava", "Polvo", "Ola", "Humo", "Lago", "Montaña", "Incendio", "Tormenta", "Nube", "Lluvia", "Planta", "Piedra", "Metal", "Ceniza", "Árbol", "Madera", "Rayo"];
const libres = [];
for (let i = 0; i < POOL.length; i++) for (let j = i; j < POOL.length; j++) if (!R.has(key(POOL[i], POOL[j]))) libres.push([POOL[i], POOL[j]]);
PAISES.forEach(([pais, cosa], i) => {
  const [a, b] = libres[i];
  add(a, b, cosa, "🧩");
  add("Selección", cosa, pais, "🏳️");
});

// 3) Categorías: «elemento base + país = nombre». Cada línea es «País=Nombre;País=Nombre».
const CAT = (base, emoji, datos) => datos.trim().split(";").forEach((p) => {
  const [pais, nombre] = p.split("=").map((s) => s.trim());
  if (pais && nombre) add(base, pais, nombre, emoji);
});

CAT("Arquero", "🧤", `Argentina=Dibu Martínez;Brasil=Alisson;Chile=Claudio Bravo;Uruguay=Fernando Muslera;Colombia=David Ospina;México=Guillermo Ochoa;Estados Unidos=Tim Howard;Perú=Pedro Gallese;Paraguay=José Luis Chilavert;España=Iker Casillas;Francia=Hugo Lloris;Alemania=Manuel Neuer;Italia=Gianluigi Buffon;Inglaterra=Jordan Pickford;Portugal=Rui Patrício;Países Bajos=Edwin van der Sar;Bélgica=Thibaut Courtois;Croacia=Dominik Livaković;Suiza=Yann Sommer;Dinamarca=Peter Schmeichel;Polonia=Wojciech Szczęsny;Gales=Wayne Hennessey;Grecia=Antonios Nikopolidis;Japón=Eiji Kawashima;Corea del Sur=Kim Seung-gyu;Arabia Saudita=Mohammed Al-Owais;Marruecos=Yassine Bounou;Senegal=Édouard Mendy;Egipto=Essam El-Hadary;Camerún=André Onana;Nigeria=Vincent Enyeama;Ghana=Richard Kingson;Australia=Mat Ryan`);
CAT("Defensa", "🛡️", `Argentina=Cuti Romero;Brasil=Thiago Silva;Chile=Gary Medel;Uruguay=Diego Godín;Colombia=Yerry Mina;México=Rafael Márquez;Paraguay=Carlos Gamarra;España=Sergio Ramos;Francia=Raphaël Varane;Alemania=Mats Hummels;Italia=Paolo Maldini;Inglaterra=John Terry;Portugal=Pepe;Países Bajos=Virgil van Dijk;Bélgica=Vincent Kompany;Croacia=Joško Gvardiol;Suiza=Manuel Akanji;Dinamarca=Simon Kjær;Turquía=Merih Demiral;Serbia=Nemanja Vidić;Japón=Takehiro Tomiyasu;Corea del Sur=Kim Min-jae;Senegal=Kalidou Koulibaly;Costa de Marfil=Kolo Touré`);
CAT("Mediocampista", "🧠", `Argentina=Rodrigo De Paul;Brasil=Casemiro;Chile=Arturo Vidal;Uruguay=Federico Valverde;Colombia=James Rodríguez;México=Héctor Herrera;Ecuador=Moisés Caicedo;España=Andrés Iniesta;Francia=Zinedine Zidane;Alemania=Toni Kroos;Italia=Andrea Pirlo;Inglaterra=Steven Gerrard;Portugal=Bruno Fernandes;Países Bajos=Frenkie de Jong;Bélgica=Kevin De Bruyne;Croacia=Luka Modrić;Suiza=Granit Xhaka;Dinamarca=Christian Eriksen;Polonia=Piotr Zieliński;Turquía=Hakan Çalhanoğlu;Escocia=Scott McTominay;Gales=Aaron Ramsey;Serbia=Sergej Milinković-Savić;Japón=Shinji Kagawa;Senegal=Idrissa Gueye;Marruecos=Sofyan Amrabat;Ghana=Thomas Partey;Costa de Marfil=Yaya Touré;Nigeria=John Obi Mikel`);
CAT("Delantero", "⚽", `Argentina=Lionel Messi;Brasil=Ronaldo Nazário;Chile=Alexis Sánchez;Uruguay=Luis Suárez;Colombia=Radamel Falcao;México=Chicharito Hernández;Estados Unidos=Landon Donovan;Perú=Paolo Guerrero;Ecuador=Enner Valencia;Paraguay=Roque Santa Cruz;Venezuela=Salomón Rondón;Bolivia=Marcelo Moreno;España=David Villa;Francia=Kylian Mbappé;Alemania=Thomas Müller;Italia=Paolo Rossi;Inglaterra=Harry Kane;Portugal=Cristiano Ronaldo;Países Bajos=Marco van Basten;Bélgica=Romelu Lukaku;Croacia=Davor Šuker;Suecia=Zlatan Ibrahimović;Polonia=Robert Lewandowski;Turquía=Hakan Şükür;Escocia=Denis Law;Gales=Gareth Bale;Serbia=Aleksandar Mitrović;Corea del Sur=Son Heung-min;Arabia Saudita=Salem Al-Dawsari;Marruecos=Youssef En-Nesyri;Senegal=Sadio Mané;Egipto=Mohamed Salah;Camerún=Samuel Eto'o;Nigeria=Victor Osimhen;Ghana=Asamoah Gyan;Costa de Marfil=Didier Drogba;Australia=Tim Cahill`);
CAT("Extremo", "💨", `Argentina=Ángel Di María;Brasil=Vinícius Júnior;Chile=Eduardo Vargas;Colombia=Luis Díaz;México=Hirving Lozano;Estados Unidos=Christian Pulisic;España=Lamine Yamal;Francia=Ousmane Dembélé;Alemania=Leroy Sané;Italia=Federico Chiesa;Inglaterra=Bukayo Saka;Portugal=Rafael Leão;Países Bajos=Memphis Depay;Bélgica=Eden Hazard;Croacia=Ivan Perišić;Suiza=Xherdan Shaqiri;Suecia=Dejan Kulusevski;Turquía=Arda Güler;Japón=Kaoru Mitoma;Corea del Sur=Lee Kang-in;Marruecos=Hakim Ziyech;Senegal=Ismaïla Sarr;Egipto=Trézéguet;Nigeria=Alex Iwobi;Ghana=Mohammed Kudus`);
CAT("Lateral", "↔️", `Argentina=Nahuel Molina;Brasil=Cafu;Chile=Mauricio Isla;Colombia=Juan Guillermo Cuadrado;Estados Unidos=Sergiño Dest;Ecuador=Pervis Estupiñán;España=Jordi Alba;Francia=Theo Hernández;Alemania=Joshua Kimmich;Italia=Gianluca Zambrotta;Inglaterra=Trent Alexander-Arnold;Portugal=João Cancelo;Países Bajos=Denzel Dumfries;Marruecos=Achraf Hakimi;Escocia=Andy Robertson;Japón=Yuto Nagatomo`);
CAT("Leyenda", "⭐", `Argentina=Diego Maradona;Brasil=Pelé;Chile=Elías Figueroa;Uruguay=Obdulio Varela;Colombia=Carlos Valderrama;México=Hugo Sánchez;Perú=Teófilo Cubillas;España=Raúl González;Francia=Michel Platini;Alemania=Franz Beckenbauer;Italia=Roberto Baggio;Inglaterra=Bobby Charlton;Portugal=Eusébio;Países Bajos=Johan Cruyff;Bélgica=Enzo Scifo;Dinamarca=Michael Laudrup;Polonia=Zbigniew Boniek;Escocia=Kenny Dalglish;Gales=Ryan Giggs;Serbia=Dragan Stojković;Corea del Sur=Park Ji-sung;Camerún=Roger Milla;Ghana=Abedi Pelé;Nigeria=Jay-Jay Okocha`);
CAT("Técnico", "📋", `Argentina=Lionel Scaloni;Brasil=Tite;Chile=Manuel Pellegrini;Uruguay=Óscar Tabárez;Colombia=Néstor Lorenzo;México=Javier Aguirre;España=Luis Enrique;Francia=Didier Deschamps;Alemania=Joachim Löw;Italia=Carlo Ancelotti;Inglaterra=Gareth Southgate;Portugal=José Mourinho;Países Bajos=Louis van Gaal;Croacia=Zlatko Dalić;Escocia=Alex Ferguson`);
CAT("Goleador", "🔝", `Argentina=Gabriel Batistuta;Brasil=Romário;Chile=Marcelo Salas;Uruguay=Edinson Cavani;Colombia=Faustino Asprilla;México=Jared Borgetti;Estados Unidos=Clint Dempsey;Perú=Jefferson Farfán;Ecuador=Agustín Delgado;Paraguay=Arsenio Erico;España=Fernando Torres;Francia=Thierry Henry;Alemania=Miroslav Klose;Italia=Gigi Riva;Inglaterra=Wayne Rooney;Portugal=Pauleta;Países Bajos=Robin van Persie;Bélgica=Bernard Voorhoof;Suiza=Alexander Frei;Dinamarca=Jon Dahl Tomasson;Suecia=Henrik Larsson;Polonia=Włodzimierz Lubański;Turquía=Burak Yılmaz;Serbia=Savo Milošević;Grecia=Nikos Anastopoulos;Japón=Kunishige Kamamoto;Corea del Sur=Cha Bum-kun;Arabia Saudita=Majed Abdullah;Marruecos=Ahmed Faras;Senegal=Henri Camara;Egipto=Hossam Hassan;Camerún=Patrick Mboma;Nigeria=Rashidi Yekini`);
CAT("Club", "🛡️", `Argentina=Boca Juniors;Brasil=Flamengo;Chile=Colo-Colo;Uruguay=Peñarol;Colombia=Atlético Nacional;México=Club América;Estados Unidos=Inter Miami;Perú=Alianza Lima;Ecuador=Liga de Quito;Paraguay=Olimpia;Venezuela=Caracas FC;Bolivia=Bolívar;España=Real Madrid;Francia=París Saint-Germain;Alemania=Bayern Múnich;Italia=Juventus;Inglaterra=Manchester United;Portugal=Benfica;Países Bajos=Ajax;Bélgica=Anderlecht;Croacia=Dinamo Zagreb;Suiza=FC Basilea;Dinamarca=FC Copenhague;Suecia=Malmö FF;Polonia=Legia Varsovia;Turquía=Galatasaray;Escocia=Celtic;Gales=Cardiff City;Serbia=Estrella Roja;Grecia=Olympiacos;Japón=Kashima Antlers;Corea del Sur=Jeonbuk Motors;Arabia Saudita=Al-Hilal;Marruecos=Wydad Casablanca;Egipto=Al Ahly;Ghana=Asante Kotoko;Costa de Marfil=ASEC Mimosas;Australia=Sydney FC`);
CAT("Escudo", "🛡️", `Argentina=River Plate;Brasil=Corinthians;Chile=Universidad de Chile;Uruguay=Club Nacional;Colombia=Millonarios;México=Chivas;Perú=Universitario;Ecuador=Barcelona SC;Paraguay=Cerro Porteño;Bolivia=The Strongest;España=FC Barcelona;Francia=Olympique de Marsella;Alemania=Borussia Dortmund;Italia=AC Milan;Inglaterra=Liverpool;Portugal=FC Porto;Países Bajos=PSV Eindhoven;Bélgica=Club Brujas;Croacia=Hajduk Split;Suiza=Young Boys;Polonia=Lech Poznań;Turquía=Fenerbahçe;Escocia=Rangers;Serbia=Partizan;Grecia=Panathinaikos;Japón=Urawa Reds;Egipto=Zamalek;Marruecos=Raja Casablanca;Arabia Saudita=Al-Nassr`);
CAT("Camiseta", "👕", `Argentina=La Albiceleste;Brasil=La Canarinha;Chile=La Roja;Uruguay=La Celeste;Colombia=Los Cafeteros;México=El Tri;Estados Unidos=Los Yanquis;Perú=La Blanquirroja;Ecuador=La Tri;Paraguay=La Albirroja;Venezuela=La Vinotinto;Bolivia=La Verde;España=La Furia Roja;Francia=Les Bleus;Alemania=Die Mannschaft;Italia=La Azzurra;Inglaterra=Los Tres Leones;Portugal=A Seleção;Países Bajos=La Naranja Mecánica;Bélgica=Los Diablos Rojos;Croacia=Los Vatreni;Suiza=La Nati;Dinamarca=Dinamita Danesa;Suecia=Blågult;Polonia=Los Blanquirrojos;Turquía=Las Estrellas Crecientes;Escocia=El Ejército de Tartán;Gales=Los Dragones Rojos;Serbia=Las Águilas Blancas;Grecia=Los Piratas;Japón=Los Samuráis Azules;Corea del Sur=Los Guerreros Taeguk;Arabia Saudita=Los Halcones Verdes;Marruecos=Los Leones del Atlas;Senegal=Los Leones de la Teranga;Egipto=Los Faraones;Camerún=Los Leones Indomables;Nigeria=Las Súper Águilas;Ghana=Las Estrellas Negras;Costa de Marfil=Los Elefantes;Australia=Los Socceroos`);
CAT("Estadio", "🏟️", `Argentina=La Bombonera;Brasil=Maracaná;Chile=Estadio Nacional de Chile;Uruguay=Estadio Centenario;Colombia=El Campín;México=Estadio Azteca;Estados Unidos=Rose Bowl;Perú=Estadio Nacional del Perú;Bolivia=Estadio Hernando Siles;España=Santiago Bernabéu;Francia=Parque de los Príncipes;Alemania=Allianz Arena;Italia=San Siro;Inglaterra=Wembley;Portugal=Estádio da Luz;Países Bajos=Johan Cruyff Arena;Bélgica=Estadio Rey Balduino;Croacia=Maksimir;Suiza=St. Jakob-Park;Dinamarca=Parken;Suecia=Friends Arena;Polonia=Estadio Nacional de Varsovia;Turquía=Estadio Olímpico Atatürk;Escocia=Hampden Park;Gales=Millennium Stadium;Serbia=Marakana;Grecia=Estadio Olímpico de Atenas;Japón=Estadio Nacional de Tokio;Corea del Sur=Estadio Mundialista de Seúl;Arabia Saudita=Estadio Rey Fahd;Marruecos=Estadio Mohammed V;Senegal=Estadio Abdoulaye Wade;Egipto=Estadio Internacional de El Cairo;Australia=Estadio Olímpico de Sídney`);
CAT("Liga", "📅", `Argentina=Liga Profesional;Brasil=Brasileirão;Chile=Campeonato Chileno;Uruguay=Campeonato Uruguayo;Colombia=Liga Colombiana;México=Liga MX;Estados Unidos=MLS;Perú=Liga 1 del Perú;Ecuador=LigaPro;Paraguay=Torneo Paraguayo;Venezuela=Liga FUTVE;Bolivia=División Profesional;España=LaLiga;Francia=Ligue 1;Alemania=Bundesliga;Italia=Serie A;Inglaterra=Premier League;Portugal=Primeira Liga;Países Bajos=Eredivisie;Bélgica=Pro League;Croacia=HNL;Suiza=Super League suiza;Dinamarca=Superliga danesa;Suecia=Allsvenskan;Polonia=Ekstraklasa;Turquía=Süper Lig;Escocia=Premiership escocesa;Serbia=Superliga de Serbia;Japón=J1 League;Corea del Sur=K League;Arabia Saudita=Saudi Pro League;Marruecos=Botola;Egipto=Liga egipcia;Australia=A-League`);
CAT("Clásico", "🔥", `Argentina=Superclásico;Brasil=Fla-Flu;Chile=Clásico Universitario;Uruguay=Clásico del fútbol uruguayo;Colombia=Clásico paisa;México=Clásico Nacional;Estados Unidos=El Tráfico;Perú=Clásico peruano;Ecuador=Clásico del Astillero;Paraguay=Clásico paraguayo;España=El Clásico;Francia=Le Classique;Alemania=Revierderby;Italia=Derby della Madonnina;Inglaterra=Derbi del Noroeste;Portugal=O Clássico;Países Bajos=De Klassieker;Croacia=Derbi Eterno croata;Turquía=Derbi de Estambul;Escocia=Old Firm;Serbia=Derbi Eterno de Belgrado;Grecia=Derbi de los Eternos Enemigos;Egipto=Derbi de El Cairo;Marruecos=Derbi de Casablanca`);
CAT("Copa", "🏆", `Argentina=Copa Argentina;Brasil=Copa do Brasil;Chile=Copa Chile;Uruguay=Copa Uruguay;Colombia=Copa Colombia;México=Copa MX;Estados Unidos=US Open Cup;España=Copa del Rey;Francia=Copa de Francia;Alemania=DFB-Pokal;Italia=Coppa Italia;Inglaterra=FA Cup;Portugal=Taça de Portugal;Países Bajos=KNVB Beker;Bélgica=Copa de Bélgica;Croacia=Copa de Croacia;Dinamarca=Copa de Dinamarca;Suecia=Svenska Cupen;Suiza=Copa Suiza;Polonia=Copa de Polonia;Turquía=Copa de Turquía;Escocia=Copa de Escocia;Serbia=Copa de Serbia;Grecia=Copa de Grecia;Japón=Copa del Emperador;Corea del Sur=Copa FA de Corea;Arabia Saudita=Copa del Rey Guardián;Marruecos=Copa del Trono;Egipto=Copa de Egipto`);
CAT("Ciudad", "🏙️", `Argentina=Buenos Aires;Brasil=Río de Janeiro;Chile=Santiago;Uruguay=Montevideo;Colombia=Bogotá;México=Ciudad de México;Estados Unidos=Nueva York;Perú=Lima;Ecuador=Quito;Paraguay=Asunción;Venezuela=Caracas;Bolivia=La Paz;España=Madrid;Francia=París;Alemania=Berlín;Italia=Roma;Inglaterra=Londres;Portugal=Lisboa;Países Bajos=Ámsterdam;Bélgica=Bruselas;Croacia=Zagreb;Suiza=Zúrich;Dinamarca=Copenhague;Suecia=Estocolmo;Polonia=Varsovia;Turquía=Estambul;Escocia=Glasgow;Gales=Cardiff;Serbia=Belgrado;Grecia=Atenas;Japón=Tokio;Corea del Sur=Seúl;Arabia Saudita=Riad;Marruecos=Casablanca;Senegal=Dakar;Egipto=El Cairo;Camerún=Yaundé;Nigeria=Lagos;Ghana=Acra;Costa de Marfil=Abiyán;Australia=Sídney`);
CAT("Historia", "📖", `Argentina=La Mano de Dios;Brasil=El Mineirazo;Chile=La Copa América 2015;Uruguay=El Maracanazo;Colombia=El Escorpión de Higuita;Estados Unidos=El Mundial del 94;España=La Roja de Oro;Francia=El cabezazo de Zidane;Alemania=El Milagro de Berna;Italia=El Calciopoli;Inglaterra=El gol fantasma;Portugal=La Eurocopa 2016;Países Bajos=La final de 1974;Bélgica=La Generación Dorada;Croacia=La final de Rusia 2018;Dinamarca=La Eurocopa del 92;Grecia=La Eurocopa del 2004;Marruecos=La semifinal de Catar;Corea del Sur=La semifinal de 2002;Japón=El Milagro de Doha;Camerún=Los cuartos de 1990;Senegal=La victoria sobre Francia;Arabia Saudita=La victoria sobre Argentina;Ghana=La mano de Suárez;Gales=La semifinal de la Euro`);
CAT("Equipo", "👥", `Argentina=Argentina 86;Brasil=Brasil 70;Alemania=Alemania 74;España=España 2010;Francia=Francia 98;Italia=Italia 82;Países Bajos=La Naranja de 1974;Uruguay=Uruguay 1950;Inglaterra=Inglaterra 66;Portugal=Portugal 2016;Croacia=Croacia 2018;Marruecos=Marruecos 2022;Chile=Chile 2015;Colombia=Colombia 2014;México=México 70`);

CAT("Mundial", "🌎", `Uruguay=Mundial 1930;Italia=Mundial 1934;Brasil=Mundial 1950;Suiza=Mundial 1954;Suecia=Mundial 1958;Chile=Mundial 1962;Inglaterra=Mundial 1966;México=Mundial 1970;Alemania=Mundial 1974;Argentina=Mundial 1978;España=Mundial 1982;Estados Unidos=Mundial 1994;Francia=Mundial 1998;Japón=Mundial 2002`);
CAT("Capitán", "©️", `Argentina=Daniel Passarella;Brasil=Dunga;Chile=Iván Zamorano;Uruguay=Diego Lugano;Colombia=Mario Yepes;México=Cuauhtémoc Blanco;Perú=Héctor Chumpitaz;Alemania=Philipp Lahm;Italia=Fabio Cannavaro;España=Carles Puyol;Inglaterra=David Beckham;Portugal=Luís Figo;Países Bajos=Giovanni van Bronckhorst;Dinamarca=Morten Olsen;Croacia=Zvonimir Boban`);
CAT("Pase", "↗️", `Argentina=Juan Román Riquelme;Brasil=Kaká;Chile=Jorge Valdivia;Uruguay=Álvaro Recoba;Colombia=Juan Fernando Quintero;Paraguay=Julio César Romero;Perú=Nolberto Solano;Ecuador=Álex Aguinaga;España=Xavi Hernández;Francia=Antoine Griezmann;Alemania=Mesut Özil;Italia=Francesco Totti;Inglaterra=Paul Scholes;Portugal=Rui Costa;Países Bajos=Dennis Bergkamp;Bélgica=Axel Witsel`);
CAT("Táctica", "📐", `Argentina=Bilardismo;Brasil=Jogo Bonito;Alemania=Gegenpressing;Inglaterra=Kick and rush;Uruguay=Garra charrúa;Chile=Juego de Bielsa;Portugal=Mourinhismo;Francia=Fútbol de Deschamps;Croacia=Orgullo croata;Marruecos=Bloque bajo marroquí`);
CAT("Hinchada", "📣", `Argentina=La Doce;Chile=Los de Abajo;Brasil=La Torcida;Italia=Los Ultras;Alemania=La Muralla Amarilla;Inglaterra=El Kop;Escocia=El Ejército de Tartán;Turquía=Ultrá Aslan;Perú=La Trinchera Norte;Colombia=Los del Sur;Uruguay=Barra Amsterdam;México=La 12 mexicana`);
CAT("Cantera", "🌱", `España=La Masía;Francia=Clairefontaine;Países Bajos=La Academia de Ajax;Argentina=Las inferiores;Brasil=Las categorías de base;Portugal=La Academia de Sporting;Alemania=Los centros de formación;Inglaterra=La Academia de St George's;Chile=La cantera de Colo-Colo;Uruguay=La cantera de Peñarol`);
CAT("Árbitro", "🧑‍⚖️", `Italia=Pierluigi Collina;Argentina=Néstor Pitana;Inglaterra=Howard Webb;Alemania=Markus Merk;Francia=Clément Turpin;España=Mateu Lahoz;Chile=Julio Bascuñán;Brasil=Sandro Ricci;Uruguay=Esteban Ostojich;México=Joel Aguilar`);

// Cuántos niveles de combinación separan a cada elemento de los cuatro básicos.
let DEPTH = null;
export function profundidades() {
  if (DEPTH) return DEPTH;
  const d = new Map(INICIALES.map((i) => [i.n, 0]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, v] of R) {
      const [a, b] = k.split("|");
      if (!d.has(a) || !d.has(b)) continue;
      const c = Math.max(d.get(a), d.get(b)) + 1;
      if (!d.has(v.n) || c < d.get(v.n)) { d.set(v.n, c); changed = true; }
    }
  }
  return (DEPTH = d);
}

// Cosas que no son de fútbol (el camino hacia la pelota): no salen de reto.
const NATURALEZA = new Set(["Vapor", "Barro", "Lava", "Polvo", "Ola", "Humo", "Lago", "Montaña", "Incendio", "Tormenta", "Nube", "Cielo", "Lluvia", "Planta", "Piedra", "Metal", "Acero", "Espada", "Ladrillo", "Muro", "Ceniza", "Árbol", "Bosque", "Madera", "Rayo", "Pasto", "Poste", "Tecnología", "Red", "Luces", "Reloj"]);

// Reto del día: el mismo para todos (sale de la fecha). Pide algo ni muy cerca ni muy lejos de los básicos.
export function retoDelDia(fecha) {
  const d = profundidades();
  const emoji = new Map([...R.values()].map((v) => [v.n, v.e]));
  const pool = [...d].filter(([nombre, n]) => n >= 5 && n <= 8 && !NATURALEZA.has(nombre) && emoji.get(nombre) !== "🧩").map(([nombre]) => nombre).sort((a, b) => a.localeCompare(b, "es"));
  let h = 0;
  for (const ch of String(fecha)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const nombre = pool[h % pool.length];
  return { n: nombre, e: emoji.get(nombre) || "⚽", niveles: d.get(nombre) };
}

export const RECETAS = R;
export const combinar = (a, b) => R.get(key(a, b)) || null;
export const TOTAL = new Set([...[...R.values()].map((r) => r.n), ...INICIALES.map((i) => i.n)]).size;
