# Futotal 2.0 · Traspaso para implementar, subir a GitHub y desplegar en Render

Este documento es para la sesión que va a **implementar el rediseño en el código real**, subirlo a GitHub y desplegarlo en Render. Lo escribió la sesión de diseño. Contiene todo lo decidido con el dueño del proyecto, qué cambia en el código actual y en qué orden hacerlo.

- **Prototipo de referencia (HTML, un solo archivo):** `docs/redisenio/prototipo-futotal-2.html`. Se abre con doble clic en cualquier navegador. No usa servidor. Es la fuente de verdad visual y de comportamiento.
- **Prototipo publicado:** https://claude.ai/artifact/WzQpWAYfJy45Pi9dUU2p7A (privado; solo lo ve su dueño).
- **Repo:** https://github.com/SantiWilli23/football-quiz · **Rama de trabajo:** `claude/futotal-major-redesign-bl4ibi`.

> Regla de oro del dueño: **él decide al final**. Lo que rechazó no se hace. Lo que no comentó, se hace. Lo que le gustó, se hace con el máximo cuidado. Habla español y quiere crítica honesta, no que le den siempre la razón.

---

## 0. Qué hacer, en 8 pasos

1. `git fetch origin && git checkout claude/futotal-major-redesign-bl4ibi && git pull`.
2. Leer este archivo completo y abrir el prototipo en el navegador. Recorrerlo con el selector **Evento**, **Día** y **Modo** de la barra superior.
3. Correr la app actual para conocer la base: `cd server && npm i && npm run seed && npm run dev` y `cd client && npm i && npm run dev`.
4. Implementar **por fases** (sección 12). No hacer todo en un commit. Cada fase debe dejar la app funcionando.
5. Tests: `npm test --prefix server` debe pasar antes de cada push. Agregar tests de los puntos y clubes (sección 12, fase 1).
6. Migraciones solo con el patrón idempotente que ya usa `server/db/client.js` (comprobar si la columna existe y luego `ALTER TABLE`). **Nunca** borrar datos.
7. Subir a GitHub (sección 13). **No abrir un Pull Request salvo que el dueño lo pida.**
8. Desplegar en Render (sección 13) y revisar `/api/health`.

---

## 1. Qué es Futotal hoy (hallazgos del código)

Stack: Express + `@libsql/client` (SQLite/Turso) + JWT en `server/`, y React + Vite + Tailwind en `client/`. Un solo servicio en Render. Detalles útiles:

| # | Hallazgo | Dónde |
|---|---|---|
| A1 | El juego diario muestra "14/20", pero al grupo solo llega el podio del día (5/3/1), un día después y solo si juegan 2 o más. | `server/utils/weekly-points.js` (`dailyPlacementPointsByUser`), `server/utils/points-config.js` |
| A2 | Hay dos rankings que no coinciden. El "histórico" solo suma trivia, Modo B y duelos; el del mes suma ~12 fuentes. | `server/routes/groups.js` (GET `/:id`), `server/routes/stats.js` (`rankingBetween`) |
| A3 | La racha se calcula con respuestas de trivia, que ya no existe. No avanza. | `server/utils/points.js` (`getCurrentStreak`, `getBestStreak`) |
| A4 | El "día" es UTC (cambia a las 21:00 en Chile). | `todayStr()` en `server/utils/points.js` y los usos en rutas |
| A5 | **Se puede hacer trampa**: el cliente manda `fraction` y el servidor le cree. Igual con victorias online. | `server/routes/daily-games.js`, `server/routes/online-games.js` |
| A6 | Cartas solo existe si el dueño activa el grupo y hay 3+ miembros. | `server/routes/cards.js` (`hasCardsAccess`), `server/routes/groups.js` (`cards/toggle`) |
| A7 | Código y textos muertos: Trivia, Modo B, banco de preguntas, Pase de temporada, misiones, avisos de "reto semanal" de Fichado/Un Minuto, portada que dice "Trivia diaria". | varios |
| — | No hay recuperación de contraseña aunque se pide email. | `server/routes/auth.js` |
| — | `goltexto/` es otra versión de Fichado que no se publica. | `goltexto/` |
| — | El catálogo tiene ~35 entradas jugables entre Juegos, "¿Quién sabe más?", Carrera, temporada. | `client/src/data/gameCatalog.js`, `client/src/pages/*.jsx` |
| — | Cotrero (`client/public/cotrero.html`, `cotrero-medio.html`), 8a2 (`draft-europeo.html`) y Mentiroso son páginas HTML aparte con su propio diseño. | `client/public/` |

El servidor ya lee partidos reales (ESPN y api-football) en `server/utils/football-api.js` (Chile, Premier, LaLiga, Serie A, Bundesliga, Ligue 1). Sirve para detectar partidos temáticos.

---

## 2. Decisiones APROBADAS

### 2.1 Puntos, clubes y sobres
- **"Grupo" pasa a llamarse "Club".** Una sola tabla con vistas **Hoy / Mes / General**. Se elimina el ranking histórico viejo.
- **Modo del club, elegido al crearlo:** *Clásico* o *Total*.
  - *Clásico:* solo cuentan el partido del día y la copa semanal.
  - *Total:* cuenta todo; el partido del día y la copa **valen el doble**; las partidas libres suman con tope de **100 pts por día**; el podio semanal de DT Online suma 60/40/20.
  - El modo solo se cambia el día 1 de cada mes. **En pretemporada el dueño lo cambia cuando quiera.**
- **Partidas libres:** suman puntos **solo la primera vez del día en cada juego** y **solo en clubes Total**. En clubes Clásico (o sin club) se muestra "Ganarías X pts · no van al club porque es Clásico" (o "no van a ningún club"). Las partidas siguientes del mismo juego dan solo sobres.
- **Pretemporada:** un club nuevo no suma puntos hasta que su **dueño inicia la temporada** (mínimo 2 miembros). Así todos pueden entrar. Después del primer inicio, cada mes arranca solo el día 1. Quien entra a mitad de mes **aparece en la tabla desde el mes siguiente** (juega y gana sobres igual).
- **Sin límite de clubes.** El mismo partido del día cuenta en todos los clubes del usuario.
- **Club principal:** el usuario marca uno. Los **sobres normales** se ganan en cualquier club con temporada iniciada. El **súper sobre (Élite del podio del mes)** solo sale del club principal. El principal se cambia solo el día 1 de cada mes.
- **Sobres:** para tener sobres basta estar en un club con la temporada iniciada. Sin eso, los sobres ganados **se guardan cerrados (máximo 3)** y se desbloquean al entrar a un club iniciado. **Excepción:** el sobre de bienvenida del registro se abre sin club.
- **Fin de mes:** si quedas en el podio (1°, 2° o 3°) del club principal, ceremonia especial (trofeo, rayos, confeti) y un **Sobre Élite** con una carta de 90 o más asegurada. Trofeo a la vitrina.
- **Racha del club:** si todos los miembros juegan el partido del día, el club gana un sobre extra.
- **Racha personal:** cuenta días en que jugaste el partido del día, con **protector** (1 por semana).
- **Rival de la semana automático** (el que está justo arriba en la tabla; si eres primero, el de abajo). Reemplaza al "archienemigo" manual.
- **Ficha de miembro:** tocar a alguien abre su ficha. Botones: "Supera mi marcador" (desafío, sin puntos) y "Cara a cara" (solo si ambos jugaron hoy; compara pregunta por pregunta y tiempos). Desde ahí, "Pedir revancha" abre un Versus.
- **Insignias del club** (se ganan entre todos, desbloquean piezas del escudo) y **uniforme del club** (anillo de color en los avatares).
- **Liga de clubes:** queda como **"próximamente"** (tarjeta con candado). Se abrirá cuando haya al menos 5 clubes con la temporada iniciada.
- **Misiones, Pase de temporada, Reto del día:** se eliminan.
- **Recuperación de cuenta:** **código de recuperación** que se muestra una vez al registrarse (y se puede ver en Yo › Ajustes).

### 2.2 Partido del día
- **3 minijuegos de ~1 minuto:** 1T (¿Quién es?), 2T (Más o menos) y un tercero. Marcador 0–100 (0–200 en Total). Igual para todos el mismo día.
- **El tercero ya no es de reflejos:** son **3 "penales" que se patean respondiendo una pregunta rápida (≈6 s)**: acertar es gol, fallar es atajado. Mide conocimiento, no el teléfono.
- **El tiempo pesa solo el 20%** de cada pregunta (80% por acertar). Así no gana quien tiene mejor internet.
- **Dificultad igual todos los días:** cada pregunta tiene una nota medida con datos reales (% de acierto, tiempo). Cada partido se arma para un promedio esperado fijo (~60/100). Una pregunta algo más fácil o difícil no es grave porque todos reciben la misma. Calibración **liviana**, no bloquea preguntas.
- **Cambio de día a las 00:00 de Chile** (`America/Santiago`).
- **Puntaje calculado en el servidor.** El cliente solo manda respuestas; el servidor tiene las respuestas correctas (arregla A5).
- **Fantasma del rival:** mientras juegas, una marca en la barra de tiempo muestra dónde respondió el rival de la semana (sin decir qué respondió) y un marcador "Tú 3 · Juan 2". Al final: "Le ganaste al fantasma de Juan". Se puede apagar en Ajustes.
- **Así respondió el club:** después de jugar, % de acierto del club por pregunta.
- **Partidos pasados (archivo):** se juegan sin puntos ni sobre.
- **Carta del día:** si aciertas el ¿Quién es? del día, te llevas esa carta (edición con la fecha). Álbum calendario con un casillero por día; si faltas, queda vacío para siempre. La edición del día no se vende ni se entrega en SBC.
- **El día después** (tras un partido temático): una pregunta extra sin puntos; si aciertas, insignia.
- **Esta semana:** tarjeta con los partidos temáticos, el SBC activo y la copa.
- **Copa semanal automática, sin inscripción:** lunes a jueves clasificas con la suma de tus partidos; con 8+ miembros hay cuartos, semis y final; con 4–7, semis (sábado) y final (domingo); con 2–3, solo final el domingo (el viernes solo se confirma el cuadro). Cada cruce lo gana quien saque más en el partido del día; si no juegas, pierdes. Empate: gana quien sumó más de lunes a jueves.

### 2.3 Partidos temáticos (L3, el favorito del dueño)
Un "kit" por evento: colores, animación de entrada, figuras emblemáticas, juego especial, preguntas, SBC de la semana, sobre e insignia. **Agregar un evento = llenar un kit**, sin programar de nuevo. El juego especial **reemplaza al tercero** (penales). Las dos primeras partes llevan **mitad de preguntas de cada club**.

| Evento | Colores y entrada | Figuras | Juego especial | SBC |
|---|---|---|---|---|
| Real Madrid vs Barcelona | pantalla partida blanco / azul y grana | Messi y Cristiano | ¿Messi o Cristiano? | 11 del Clásico |
| Colo-Colo vs U. de Chile | humo de bengalas, papel picado | ídolos de cada club | ¿Albo, azul o los dos? | 11 de La Roja |
| Final de Champions | noche azul con lluvia de estrellas | campeones de Europa | Campeones de Europa | 11 de campeones de Europa |
| (a futuro) Final de Libertadores, Inter–Milan, Bayern–Dortmund, Liverpool–Man United, Selección chilena | ver `EVENTS` en el prototipo | | | |

- **Regla de cuándo hay uno:** prioridad 1 clásicos chilenos; 2 grandes clásicos europeos; 3 (más adelante) Champions desde semifinales, Libertadores, selección. Máximo 2 por semana. Se detecta con el calendario de `football-api.js`.
- **Previa** el día anterior en Hoy (cuenta regresiva, aviso, y **pronóstico del partido real** de un toque: no da puntos, da sobre si aciertas).
- **¿Con quién vas?** antes de jugar. Al cerrar el día, el club ve qué hinchada ganó ("Duelo de hinchadas") y se guarda un **historial de clásicos del club**. No cambia los puntos de nadie.
- **Marcador del partido real en vivo** en Hoy mientras se juega.
- **Premio:** insignia del evento + **sobre del evento**. Esa semana el SBC y la carta del día comparten el tema.
- **Final de Champions:** hacer un diseño propio de "noche de estrellas". **No usar el logo oficial** (es marca registrada).
- **Los datos del juego especial** (quién jugó dónde, campeones por año) son listas pequeñas que **hay que revisar a mano** antes de publicar.

### 2.4 Juegos: de ~35 entradas a 13
| Nuevo | Reemplaza a |
|---|---|
| ¿Quién es? | Fichado, ¿Quién es?, Traspasos a ciegas |
| ¿Qué club? | Escudos a ciegas, Torta de plantel |
| Más o menos | Pirámide, ¿A quién me compro? |
| Trivia | Un Minuto, Supervivencia |
| VAR | Arbitraje/VAR, Votación del VAR |
| Bingo | igual |
| Versus (ruleta que elige el modo) | Duelos, Mentiroso, Equipo-Jugador, ¿Quién es? en vivo, Dorsal histórico |
| Draft (solo / copa / subasta) | 8a2, Copa 8a2, Subasta |
| DT Online | igual |
| Modo DT | igual |
| Presidente | igual |
| **Cotrero simple** | Cotrero simple |
| **Cotrero medio** | Cotrero medio (el dueño pidió mantener las dos versiones) |

**Se eliminan:** Fantasy, "En vivo" (resultados reales como pantalla), Vida FUT, Quiniela, Campeón y descenso, Mercado de pases, torneos de duelos, buscador Ctrl+K, apuestas en duelos, liga de dos divisiones, banco de preguntas del grupo, retos semanales, Estadísticas e Historial como páginas aparte (pasan a "Yo"), Modo B, Trivia, Pase de temporada, `goltexto/`.

**Cotrero simple = Copero (copero.com.ar).** Crear jugador con apellido, número, pie hábil, nacionalidad y posición. Velocidad de carrera: Intensa (una decisión por temporada), Normal (cada 2), Exprés (cada 3). Decisiones tipo entrenar más, cambiar de club, préstamo, pelear la titularidad. El azar define buena parte del resultado.

**Cotrero medio = El Ídolo (potrerofutbol.ar).** Elegir posición (delantero o enganche) y liga de inicio. Pretemporada: elegir qué estadística mejorar. Eventos de decisión con **reputación** (de "Mercenario" a "Ídolo del hincha"). Convocatoria a la selección. Al retirarte: resumen con clubes, logros, comparación con una figura histórica y un puntaje para un ranking.

**8a2 con el flujo de 7a0 (7a0.org).** Elegir formación y estilo; en cada ronda sale un plantel histórico de Champions (ruleta) y se elige un jugador por posición; modo "a ciegas" (sin ver puntajes). **Se mantiene la simulación de partidos** (cuartos, semis, final con partido animado). Usa los planteles de Champions que 8a2 ya tiene; solo se copia la forma de elegir.

> En los tres casos: **copiar estructura, ritmo y jugabilidad, no la marca, los textos ni los gráficos.** Se mantienen **los colores actuales de Futotal**.
> Las tres páginas no se pudieron abrir desde la sesión de diseño; el comportamiento se basó en descripciones de prensa. Verificar y ajustar si algo no coincide.

### 2.5 Cartas
- Las repetidas tienen **dos usos**: **vender** (como hoy, valores en `SELL_VALUE`) o **entregar en un SBC**. **No se venden solas.**
- **SBC temático:** 11 cartas **repetidas** de la temática en formación (el jugador elige 4-3-3, 4-4-2 o 3-5-2). Siempre queda una copia de cada carta. Premio: un **sobre muy bueno de la temática** (5 cartas de la temática con una estrella asegurada). Dura **2 semanas**; temas posibles: Portugal, La Roja, Clásico, campeones de Europa, 11 que pasaron por un club, Premier, leyendas.
- **Para que sea alcanzable** (simulación: hoy serían ~440 sobres): mientras haya un SBC activo, **cada sobre ganado trae 1 carta de la temática**; el **sobre de la temática se vende en la tienda por 100 monedas**; aviso al vender una repetida que sirve para el SBC activo; contador visible "7/11 · te faltan 1 arquero y 2 defensas". Solo entran temas con al menos 2 arqueros y suficientes jugadores por línea (Croacia, Nigeria y Costa de Marfil no tienen arquero en la base).
- **Tienda con monedas** (nunca dinero real): normal 30, bueno 90, tema 100, top 220, más una oferta del día.
- **Intercambio de repetidas con un amigo del club:** 1 por día, misma categoría.
- **Partido de cartas** contra el once de un amigo: 1 por día, da monedas (40 si ganas, 15 si no), **no da puntos**.
- **Tu carta Futotal:** una carta propia cuya media es el promedio de tus últimos 30 partidos del día (bronce < 60, plata 60–74, oro 75–84, especial 85+); se da vuelta y muestra tu ADN; se comparte como texto/imagen.
- **Cartas para todos** (ya no depende de que un dueño la active).

### 2.6 ADN futbolero
- Hexágono con 6 áreas: **Chile, Europa, Leyendas, Actualidad, Mercado, Velocidad** (0–99, comparadas con todos los jugadores). Sale de **etiquetar cada pregunta por tema**.
- Un área solo se muestra con **15+ respuestas**; antes: "Faltan datos".
- **Análisis semanal** (lunes) y **mensual** (cierre de mes): mejor y peor área, cuánto subiste o bajaste, sugerencia concreta con acceso directo, comparación con el club, y el mes anterior como línea punteada. **Especialidad del mes** (aparece junto al nombre el mes siguiente) y **arquetipo** (Enciclopedia, Nostálgico, Mercadero, Hincha local, Europeo, Relámpago, Al día).
- Sesiones de **entrenamiento** de 2 minutos con preguntas de tu peor área.

### 2.7 Primer ingreso y tutorial
- **Portada = partido de práctica** de 3 minijuegos, sin registro. Al final: "Sacaste X. Guárdalo." → registro corto (usuario + contraseña) → **código de recuperación** → elegir club de fútbol favorito → **sobre de bienvenida** (carta segura de ese club) → "Crea tu club o únete con un código".
- **Invitación con desafío:** el link muestra "Juan te desafía: supera sus 78".
- **Tutorial sin texto:** mano animada que muestra qué tocar (3 a 4 palabras como máximo, botón "Saltar"), la primera vez de cada juego. El botón "?" pasa a "Ver demo" (animación de 10 s). **Se elimina el tutorial de diapositivas con texto.**
- Guía animada "agregar a inicio" después del primer partido (en iPhone es la única forma de recibir avisos).

### 2.8 Navegación y diseño
- Barra inferior: **Hoy · Jugar · Club · Cartas · Yo**. Barra superior del teléfono solo con racha y campana. En computador es la misma app en una columna centrada.
- **Hoy** (máximo ~4 bloques): partido del día, tu club, copa, seguir jugando; más racha del club, esta semana y partidos pasados.
- **Jugar:** 3 tarjetas "Para ti" y filas deslizables (Arcade, Con amigos, Carrera). Cada tarjeta dice a qué reemplaza.
- **Club:** escudo y sello del modo, pestañas Tabla / Copa / Muro. Crear club en 3 pasos animados (nombre y escudo, modo, invitar).
- **Yo:** carta Futotal, ADN, vitrina, marcos de avatar, logros, historial, ajustes.
- **Animaciones: calidad máxima** (el dueño no quiere limitar la complejidad). Las grandes solo en momentos importantes (sumar puntos, pasar a alguien, abrir sobres, ganar la copa); navegar entre pantallas < 0,3 s; todo saltable; **respetar `prefers-reduced-motion`**. Se pueden usar librerías especializadas, pero **cargarlas bajo demanda** para no frenar la apertura de la app.
- **Sonido:** silbato y gol con vibración siempre; ambiente completo de estadio solo en partidos temáticos; opción de silenciar.
- **Colores:** se mantiene el tema actual de Futotal (oscuro, verde). Un solo aspecto oscuro (se evaluó mantener los 3 temas; el dueño no pidió lo contrario).

### 2.9 Técnico
- **Medir:** tabla simple de eventos (vuelven al día siguiente / a la semana, % que juega el partido del día, % en un club).
- **Lanzamiento por etapas:** primero tu club como prueba, luego todos (bandera por club).
- **Tabla en vivo:** "Juan acaba de sacar 82" sin recargar (SSE o polling corto).
- **Aviso a tu hora** (la hora en que sueles jugar), máximo 3 avisos por día. Avisos con motivo ("Juan te pasó", "Quedan 2 horas", "Mañana es la final contra Pedro").
- **Generador del partido del día:** hacen falta ~1.100 minijuegos al año; generarlos con los datos existentes (jugadores, carreras, valores, escudos) y que el dueño revise solo la semana siguiente. Actualizar planteles y valores de forma programada.
- Borrar código muerto (A7) al final de cada fase.

---

## 3. Decisiones RECHAZADAS (no hacer)
- **K5** Frases rápidas en el muro / chat libre.
- **L4** Dificultad según el día de la semana.
- **Todo el bloque O:** filtro de groserías y reporte, y "clubes solo por código" como tarea aparte (de todos modos los clubes se unen por código).
- **S8** Futotal Wrapped de diciembre.
- **J1 original:** que las repetidas se conviertan solas en monedas.
- **J8** Álbum de temporada de 300 cartas (no por ahora).
- Sobres pagados con dinero real.
- **S10** Segunda pantalla en vivo durante el clásico real (después del lanzamiento).

---

## 4. Pendientes y supuestos (confirmar con el dueño si molestan)
1. Cuál es exactamente la referencia de Copero/El Ídolo (se asumió según prensa).
2. Formación del SBC elegible por el jugador (se hizo así).
3. Sobre de bienvenida sin club (se dejó como excepción).
4. Tope de partidas libres 100 por día en Total (se mantiene).
5. El sobre Élite "muy bueno" es 5 cartas con una de 90+ asegurada (ajustable).
6. Los valores de ejemplo del prototipo (jugadores, valores de mercado, ratings, planteles históricos, "hinchada" 412 vs 380) **no son datos reales**.

---

## 5. Reglas exactas de puntos (para implementar y testear)

| Concepto | Clásico | Total |
|---|---|---|
| Partido del día | 0–100 (33 + 33 + 34) | 0–200 (×2) |
| Copa: campeón / finalista / semifinalista / participar | 200 / 120 / 60 / 20 | 400 / 240 / 120 / 40 |
| Juego libre arcade (1ª vez del día por juego) | 0 (muestra "ganarías") | 0–20 (`aciertos × 4`) |
| Versus ganado | 0 | 30 |
| Copa de Draft ganada | 0 | 30 |
| Temporada de Carrera terminada | 0 | 20 |
| DT Online podio semanal | 0 | 60 / 40 / 20 |
| **Tope de partidas libres por día** | — | **100** |

- Los puntos entran **al instante** en el libro (no al día siguiente) y la tabla se reordena.
- Si el club no inició la temporada, o el usuario entró tarde, **no se suma** (se muestra lo que habría ganado).
- Sobres por partido del día: ≥80 top, ≥50 bueno, si no normal. Partidas libres: hasta 3 sobres por día (2+ aciertos; 4+ da "bueno").

---

## 6. Modelo de datos propuesto (migraciones idempotentes)

Reusar `groups_t` / `group_members` como "clubs" (no renombrar tablas; renombrar solo textos y rutas visibles).

```sql
-- clubes
ALTER TABLE groups_t ADD COLUMN club_mode TEXT NOT NULL DEFAULT 'clasico';      -- 'clasico' | 'total'
ALTER TABLE groups_t ADD COLUMN season_started_at TEXT;                         -- NULL = pretemporada
ALTER TABLE groups_t ADD COLUMN mode_changed_month TEXT;
ALTER TABLE group_members ADD COLUMN joined_at TEXT DEFAULT (datetime('now'));
ALTER TABLE group_members ADD COLUMN debuts_month TEXT;                         -- 'YYYY-MM' si entró a mitad de mes
CREATE TABLE IF NOT EXISTS user_main_club (user_id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL, changed_month TEXT);

-- libro único de puntos (reemplaza las ~12 fuentes de rankingBetween)
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, group_id INTEGER NOT NULL,
  date TEXT NOT NULL, month TEXT NOT NULL, source TEXT NOT NULL, points INTEGER NOT NULL,
  UNIQUE (user_id, group_id, date, source));

-- partido del día (servidor con las respuestas correctas)
CREATE TABLE IF NOT EXISTS daily_matches (date TEXT PRIMARY KEY, event_key TEXT, items_json TEXT NOT NULL, target_avg INTEGER DEFAULT 60);
CREATE TABLE IF NOT EXISTS daily_match_answers (
  user_id INTEGER NOT NULL, date TEXT NOT NULL, idx INTEGER NOT NULL, answer INTEGER, ms INTEGER, ok INTEGER, points REAL,
  PRIMARY KEY (user_id, date, idx));
CREATE TABLE IF NOT EXISTS daily_match_results (
  user_id INTEGER NOT NULL, date TEXT NOT NULL, p1 INTEGER, p2 INTEGER, p3 INTEGER, total INTEGER, side INTEGER,
  PRIMARY KEY (user_id, date));
CREATE TABLE IF NOT EXISTS question_stats (question_id TEXT PRIMARY KEY, area TEXT, shown INTEGER DEFAULT 0, correct INTEGER DEFAULT 0, avg_ms INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS user_area_stats (user_id INTEGER, area TEXT, period TEXT, answers INTEGER DEFAULT 0, correct INTEGER DEFAULT 0, avg_ms INTEGER DEFAULT 0, PRIMARY KEY (user_id, area, period));

-- eventos temáticos y carta del día
CREATE TABLE IF NOT EXISTS events (date TEXT PRIMARY KEY, kit_key TEXT NOT NULL, teams_json TEXT, real_result TEXT);
CREATE TABLE IF NOT EXISTS event_sides (user_id INTEGER, group_id INTEGER, date TEXT, side INTEGER, PRIMARY KEY (user_id, group_id, date));
CREATE TABLE IF NOT EXISTS daily_cards (user_id INTEGER, date TEXT, player_name TEXT, PRIMARY KEY (user_id, date));

-- sobres guardados (status 'locked', máximo 3 por usuario) y cuenta
ALTER TABLE card_packs ADD COLUMN status TEXT DEFAULT 'open';                   -- 'open' | 'locked'
ALTER TABLE card_packs ADD COLUMN theme TEXT;
ALTER TABLE users ADD COLUMN recovery_hash TEXT;
ALTER TABLE users ADD COLUMN tz TEXT DEFAULT 'America/Santiago';

-- métricas
CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, props TEXT, at TEXT DEFAULT (datetime('now')));
```

Recordatorio: SQLite no tiene `ADD COLUMN IF NOT EXISTS`; usar el patrón de `server/db/client.js` (consultar `PRAGMA table_info`).

---

## 7. API (resumen de lo nuevo o cambiado)
- `GET /api/daily/today` → partido del día **sin** respuestas correctas (id, textos, opciones, tiempos). `POST /api/daily/answer {idx, answer, ms}` → `{ok}` y suma parcial. `POST /api/daily/finish` → cierra, escribe en `points_ledger` para **cada club iniciado** del usuario y devuelve premios (sobre, carta del día, racha, insignias).
- `GET /api/clubs`, `POST /api/clubs` (modo), `POST /api/clubs/:id/start` (solo dueño, mínimo 2), `POST /api/clubs/:id/mode`, `POST /api/clubs/join`, `POST /api/clubs/main`.
- `GET /api/clubs/:id/table?view=hoy|mes|general`, `/cup`, `/feed`, `/members/:uid` (ficha), `/head-to-head/:uid` (cara a cara), `/streak`.
- `GET /api/packs` (abiertos + guardados), `POST /api/packs/open`, desbloqueo automático al entrar o iniciar un club.
- Cartas: `GET /api/cards/sbc`, `POST /api/cards/sbc/:id/submit` (**solo repetidas**), `POST /api/cards/sell` (se queda), `POST /api/cards/trade`, `POST /api/cards/match`, `GET/POST /api/cards/shop`.
- `GET /api/me/adn?range=week|month`, `GET /api/me/card`.
- `GET /api/events/today|tomorrow|yesterday`, `POST /api/events/pred`, `POST /api/events/side`, `POST /api/events/day-after`.
- Auth: `POST /api/auth/register` devuelve `recoveryCode` una sola vez; `POST /api/auth/recover {username, code, newPassword}`.
- Cambio de día: usar `America/Santiago` en `todayStr()` y en todo lo que agrupe por fecha.

**Arreglos de fondo que van antes que el diseño:** A1 (puntos al instante), A2 (una sola tabla), A3 (racha), A4 (zona horaria), A5 (puntaje en servidor).

---

## 8. Mapa: prototipo → código real

| Prototipo (`prototipo-futotal-2.html`) | Real |
|---|---|
| `vHoy`, `vJugar`, `vClub`, `vCartas`, `vYo` | páginas nuevas en `client/src/pages/` (Hoy reemplaza a `Dashboard.jsx`; Club reemplaza a `Group.jsx`; Cartas a `Cartas.jsx`; Yo reemplaza a `Profile.jsx`, `Stats.jsx`, `History.jsx`) |
| `matchFlow`, `runQuiz`, `runPenaltyQ`, `evIntro`, `sidePick`, `dailyResult` | `client/src/pages/PartidoDelDia/*` + componentes de animación |
| `EVENTS`, `EVQ` | `server/data/events/*.json` (kits) + `client/src/events/` |
| `GAMES`, `SECS` | `client/src/data/gameCatalog.js` (13 entradas) |
| `cotFlow` | reemplazar `client/public/cotrero.html` y `cotrero-medio.html` por componentes React (o rehacer las páginas con el flujo nuevo) |
| `draftFlow`, `simMatch`, `SQ` | reemplazar `client/public/draft-europeo.html` (reusar sus 138 planteles y `simulateMatch`) |
| `SBCS`, `sbcFill`, `sbcAuto`, `sbcTrade`, tienda, intercambio, partido de cartas | `server/routes/cards.js` + `client/src/pages/Cartas.jsx` |
| `hexSVG`, `adnHTML`, `archetype` | `client/src/components/Adn*.jsx` |
| `preHTML`, `startSeason`, `clubsSheet`, `wizard` | `client/src/components/club/*` |
| `ACT2` (acciones) | cada una pasa a una función y una llamada a API |
| `fresh()` (estado) | lo que hoy vive en estado local del prototipo debe venir de la API |

El prototipo es **un solo archivo de ~250 KB** sin dependencias. Es útil para copiar CSS (tokens, animaciones, `@keyframes`) y la lógica de cada pantalla. Está pensado para teléfono (≈400 px de ancho) y se ve igual en computador.

---

## 9. Animaciones de referencia (ver `@keyframes` en el prototipo)
Pulso del botón JUGAR; números que suben (`countUp`); puntos que vuelan a la tabla y la fila que se reordena (técnica FLIP en `flip()`); sobres que se rompen y cartas que giran en 3D; confeti (canvas); ruleta del Versus; anillo del OVR que se llena; calendario que gira al empezar cada temporada; fichaje con escudo que entra; cuenta regresiva 3-2-1 al iniciar la temporada; trofeo que cae con rayos giratorios; entrada partida de los clásicos con camisetas; lluvia de estrellas en la final de Champions; humo en el Superclásico; hexágono del ADN que se dibuja; carta Futotal que se da vuelta; "mano" guiada del tutorial; transición deslizante entre pestañas (<0,3 s).

---

## 10. Cómo se ve el flujo de punta a punta (para tests manuales)
1. Portada → Jugar ahora → práctica con mano guiada → "Sacaste X" → registro → código de recuperación → club favorito → sobre de bienvenida (5 cartas, una de tu club).
2. "Unirme" con `BARRIO-2210` (pretemporada) → "Cartas" muestra sobres guardados → el dueño inicia → cuenta regresiva → sobres guardados se desbloquean.
3. Partido del día normal y con evento (selector **Evento** del prototipo).
4. Crear un club propio (3 pasos) → "Simular que se unen amigos" → Iniciar temporada.
5. Cartas: SBC de Portugal (autocompletar → intercambiar → abrir sobre), tienda, vender una repetida, intercambio con amigo, partido de cartas.
6. Yo: carta Futotal (tocar para dar vuelta), ADN semana/mes, entrenar un área con "Faltan datos".
7. "Fin de mes · podio" (ceremonia + sobre Élite) y "Fin de mes · sin podio".

---

## 11. Calidad y cuidado
- Mantener la accesibilidad: `prefers-reduced-motion`, foco visible, áreas táctiles ≥ 44 px, contraste suficiente.
- Todo texto de interfaz en español, directo, sin párrafos largos en el tutorial.
- No introducir dependencias pesadas en la ruta de arranque (la app usa `lazy()` por página; mantener ese patrón).
- Los datos de ejemplo del prototipo **no** deben pasar a producción sin revisar.
- No copiar marcas, logos ni textos de otros sitios (Copero, Potrero, 7a0, UEFA).

---

## 12. Orden de implementación (cada fase deja la app andando)

**Fase 0 · base y medición.** Tabla `analytics_events`, zona horaria `America/Santiago` en `todayStr()`, quitar avisos y textos muertos (A7 sin romper rutas). Tests de fechas.

**Fase 1 · puntos y clubes (lo más urgente, hoy está roto).** `points_ledger`, tabla única Hoy/Mes/General, racha nueva, puntaje del partido del día en servidor (A5), clubes con modo y **pretemporada/inicio de temporada**, quien entra tarde, club principal, sobres guardados, código de recuperación. Tests: puntos Clásico vs Total, tope 100, "una vez por juego al día", pretemporada sin puntos, entrada tardía, sobres guardados (máx. 3) y desbloqueo.

**Fase 2 · navegación y partido del día.** Barra Hoy/Jugar/Club/Cartas/Yo, pantalla Hoy, partido del día de 3 partes con penales de preguntas, calibración de dificultad, fantasma, "así respondió el club", archivo, copa automática.

**Fase 3 · juegos fusionados.** ¿Quién es?, ¿Qué club?, Más o menos, Trivia, VAR, Bingo, Versus (ruleta), Draft (8a2 estilo 7a0 con simulación), Cotrero simple (Copero) y medio (El Ídolo). Redirigir rutas viejas.

**Fase 4 · cartas.** Cartas para todos, SBC temático solo con repetidas, tienda con monedas, venta de repetidas, intercambio, partido de cartas, carta del día y álbum calendario.

**Fase 4b · motor de partidos en vivo (rehacer, ver sección 14).** Es **prerrequisito de la fase 5** y de todo lo que muestra un partido: marcador en vivo, alineaciones, previa y el día después de los eventos, DT Online, Cartas, Copa semanal, Subasta, Carrera y el 8a2.

**Fase 5 · eventos temáticos.** Kits, detección con `football-api.js`, previa, pronóstico, hinchadas, historial, "el día después". Empezar por Clásico, Superclásico y Final de Champions.

**Fase 6 · ADN y perfil.** Etiquetas por pregunta, estadísticas por área, hexágono, análisis semanal/mensual, carta Futotal, logros, marcos.

**Fase 7 · primer ingreso.** Portada = práctica, registro, favorito, sobre de bienvenida, invitación con desafío, tutorial con mano guiada (reemplaza `client/src/tutorial/`), guía "agregar a inicio".

**Fase 8 · cierre de mes y avisos.** Ceremonia de podio y Sobre Élite del club principal, resumen del lunes, avisos con motivo y "a tu hora", tabla en vivo.

**Lanzamiento por etapas:** bandera por club (`rediseño_activo`); activar primero el club del dueño, medir (`analytics_events`), luego abrir a todos.

---

## 13. Subir a GitHub y desplegar en Render

### GitHub
```bash
git fetch origin
git checkout claude/futotal-major-redesign-bl4ibi
git pull origin claude/futotal-major-redesign-bl4ibi
# ... implementar una fase ...
npm test --prefix server
cd client && npm run build && cd ..
git add -A
git commit -m "Fase N: <descripción corta>"
git push -u origin claude/futotal-major-redesign-bl4ibi
```
- Trabajar y empujar **solo a la rama indicada**. No abrir Pull Request ni fusionar a la rama principal salvo que el dueño lo pida.
- Si el push falla por red, reintentar con espera (2, 4, 8, 16 s).
- Mensajes de commit claros y en español, uno por fase o por bloque coherente.

### Render
- Ya existe `render.yaml` (un servicio web `football-quiz`, plan free): build `npm install --prefix server && npm install --prefix client && npm run build --prefix client`, start `npm start --prefix server` (ejecuta `node db/seed.js` y levanta el servidor), health check `/api/health`.
- Variables de entorno: `JWT_SECRET` (se genera sola), `DATABASE_URL` y `DATABASE_AUTH_TOKEN` (Turso; **sin esto los datos se pierden en cada despliegue**). Opcionales: `FOOTBALL_API_KEY` (si no está, usa ESPN), `PUSH_CRON_SECRET`, `VAPID_*`, `REMINDER_HOUR`, `PUSH_CONTACT`.
- Cómo desplegar:
  1. En el panel de Render, abrir el servicio → *Settings* → *Branch* y apuntarlo a `claude/futotal-major-redesign-bl4ibi` **para probar** (o crear un segundo servicio de pruebas desde el Blueprint con esa rama). Dejar la rama principal para producción.
  2. Confirmar `Auto-Deploy` en "On Commit", o usar *Manual Deploy › Deploy latest commit*.
  3. Revisar los logs: las migraciones corren al iniciar. Si falla una, **corregir la migración (idempotente)**, no tocar la base a mano.
  4. Abrir `https://<servicio>.onrender.com/api/health` y luego la app. Recorrer la sección 10.
  5. Plan gratis: el servicio se duerme sin tráfico; el primer acceso puede tardar. Para los avisos puntuales, un cron externo a `POST /api/push/send-daily` con el header `x-cron-secret`.
- **Antes de abrir el rediseño a todos:** hacer una copia de la base (Turso: `turso db shell` / exportar) y activar la bandera solo para el club del dueño.
- Rollback: en Render, *Deploys › Rollback* al despliegue anterior; las columnas nuevas no rompen la versión vieja porque son aditivas.

---

## 14. Rehacer el sistema de partidos en vivo y alineaciones (NUEVO, prioridad alta)

**Qué pidió el dueño.** El prototipo no lo muestra, pero **ya existe en la app real** y está mal: al ver la **alineación** y el **partido en vivo** en el momento, se ve **bugueado, le falta información y es poco estético**. Además **varias cosas del rediseño dependen de esto** (eventos temáticos, previa, marcador en vivo, día después, DT Online, Cartas, 8a2). Hay que **mejorarlo mucho**. Calidad máxima, sin límite de complejidad.

> **Aviso de honestidad.** Lo que sigue sale de **leer el código**, no de ver un partido real en vivo (la sesión de diseño no pudo). Son **causas probables**. **Paso 0 obligatorio:** reproducir con un partido real en vivo, guardar las respuestas crudas de la API y confirmar cada punto antes de rehacer.

### 14.1 Qué hay hoy (hay 7 piezas distintas que muestran un "partido")

| Pieza | Archivo | Para qué se usa |
|---|---|---|
| Alineación de partido real (cancha horizontal con 22 fichas) | `client/src/components/LineupPitch.jsx` | desplegable de `FixtureCard` |
| Fila de partido real y lista de titulares | `client/src/components/FixtureCard.jsx`, `client/src/pages/Football.jsx` | pantalla "En vivo" (se elimina como página, pero el contenido se reutiliza) |
| Partido simulado minuto a minuto con 22 jugadores y pelota | `client/src/components/LivePitch.jsx` | Cartas, Copa semanal, Subasta |
| Variante de cancha | `client/src/components/MatchPitch.jsx` | partidos con cartas |
| Simulador de Carrera | `client/src/carrera/components/MatchSimulator.jsx` | Modo DT |
| Partido en vivo de DT Online (WebSocket) | `client/src/dt-liga/LiveMatch.jsx`, `server/dt-live.js`, `server/ws-relay.js` | liga online |
| Simulación del 8a2 | `client/public/draft-europeo.html` | 8a2 |

Cada una tiene su propio estilo, su propia cancha y su propio formato de eventos. **Eso es parte del problema.**

### 14.2 Causas probables de lo "bugueado" y "faltante" (verificar en el paso 0)

**Datos del partido real**
1. `espnLineups()` (`server/utils/football-api.js`) devuelve `coach: null` y **no trae `grid`**; `formation` puede venir vacía. Con ESPN (la fuente por defecto, sin clave) **nunca hay DT ni posición exacta**.
2. `LineupPitch.place()` agrupa por la primera letra de la posición (`G`, `D`, `M`, `F`). Las abreviaturas de ESPN (por ejemplo `CD-L`, `LB`, `CM`, `AM-R`, `LW`, `CF`) **no calzan**, así que varios jugadores caen en una fila "resto" y la formación sale rota.
3. **No hay eventos del partido**: ni goles con minuto y autor, ni tarjetas, ni cambios, ni VAR, ni estadísticas (posesión, tiros), ni comentarios. La API de ESPN los trae en el resumen del partido, pero hoy no se leen.
4. **No hay minuto en vivo ni actualización fluida.** La pantalla recarga cada cierto tiempo (`Football.jsx`, `REFRESH_MS`) y el servidor cachea 60–180 s: el marcador se ve atrasado y a saltos. No hay aviso de gol.
5. La alineación solo se ofrece **cuando el partido ya empezó** (`FixtureCard`). No hay **alineación probable** antes del partido, que es justo lo que sirve en la previa de un clásico.
6. Con `api-football` (cuando hay clave) el plan gratis solo permite temporadas viejas y cae a datos "demo"; el servidor lo avisa, pero la interfaz puede mostrar un partido de otra temporada como si fuera de hoy. Revisar que siempre se marque claramente.
7. ESPN se usa a través de un endpoint **no oficial**: puede cambiar sin aviso. Hace falta tolerancia a campos ausentes y pruebas con respuestas guardadas.

**Interfaz**
8. `LineupPitch` dibuja en un SVG de **1000 × 520 unidades con texto de 14–15**. En un teléfono de ~360 px el texto queda de **~5 px: ilegible**. Mismo problema de escala en `LivePitch` (600 × 380).
9. Los 22 jugadores están en **una sola cancha horizontal** con círculos y apellido. No hay fotos, ni rating, ni indicadores de gol/tarjeta/cambio, ni banca con información. Es "poco estético" y no se entiende quién hizo qué.
10. El partido simulado (`LivePitch`) **inventa el movimiento** de la pelota y las ocasiones con una semilla; no hay línea de tiempo de eventos real ni repetición de jugadas. Y cada pantalla que lo usa lo adapta a su manera.
11. DT Online transmite por WebSocket con un formato propio de eventos; no comparte código con los demás.

### 14.3 Qué construir

**A. Un modelo único de partido (servidor).** Un normalizador que convierta **cualquier fuente** (ESPN, api-football, simulador interno, DT Online, 8a2) a esta forma:

```jsonc
{
  "id": "…", "source": "espn|apifootball|sim|dt",
  "status": "NS|1H|HT|2H|ET|P|FT|AET|PEN|PST|SUSP",
  "minute": 67, "stoppage": 3,
  "teams": { "home": {"id","name","logo","colors"}, "away": {…} },
  "score": { "home": 1, "away": 0, "pens": null },
  "lineups": {
    "home": { "formation": "4-3-3", "probable": false, "coach": "…",
              "starters": [{ "id","number","name","photo","pos":"CB","line":"D","side":"L|C|R","x":0..100,"y":0..100,"rating":null,"captain":false }],
              "bench": [{ "id","number","name","pos" }] },
    "away": { … }
  },
  "events": [
    { "min": 12, "type": "goal|own_goal|pen_goal|pen_miss|yellow|red|sub|var", "team": "home", "playerId": "…", "player": "…", "assist": "…", "in": "…", "out": "…", "detail": "…" }
  ],
  "stats": { "possession": [55,45], "shots": [10,6], "onTarget": [4,2], "corners": [5,3], "fouls": [9,12] },
  "commentary": [ { "min": 12, "text": "…" } ],
  "updatedAt": "…"
}
```
- **Tabla de posiciones** ESPN/api-football → línea (`G`, `D`, `M`, `F`) y lado (`L`, `C`, `R`) para ubicar a cada jugador aunque no venga `grid`; si falta la formación, **inferirla** contando por línea (4-3-3, 4-4-2…).
- **Alineación probable** antes del partido (cuando la fuente la trae) marcada como "probable".
- **Fotos de jugadores** (la app ya tiene `PlayerFace` y fotos con TheSportsDB; reutilizar).
- **Pruebas con respuestas reales guardadas** (carpeta `server/test/fixtures/live/`) para ESPN y api-football, con campos faltantes.

**B. Tiempo real eficiente y estable.**
- **Un solo consultor por partido** (no uno por usuario): el servidor consulta cada partido en vivo cada 15–30 s, comparte la caché y **empuja los cambios** a los clientes por **SSE** (`GET /api/live/:id/stream`) o WebSocket (ya existe `ws-relay.js`). Respeta el límite del plan gratis.
- **Aviso de gol** (notificación push y animación en pantalla) con un máximo de 3 avisos por día en total.
- **Reconexión automática**, "última actualización hace X s" y estado claro cuando la fuente cae (nunca mostrar datos viejos como si fueran de ahora).

**C. Interfaz nueva (pensada para teléfono).**
- **Tarjeta de partido** con escudos, marcador grande, **minuto en vivo** y estado (en vivo / entretiempo / finalizado).
- **Pestañas:** *Resumen* (línea de tiempo de eventos con íconos de gol, tarjeta, cambio y VAR) · *Alineación* · *Estadísticas* · *Comentarios*.
- **Alineación en cancha vertical, de a un equipo** (con selector Local / Visita) o las dos mitades enfrentadas, **a escala real de teléfono**: ficha con **foto, número, apellido, rating**, y **íconos sobre el jugador** (gol, asistencia, amarilla, roja, cambio, capitán). Tocar al jugador abre su ficha. **Banca** con quién entró y en qué minuto. DT y formación visibles. **Alineación probable** en la previa.
- **Estética:** los mismos tokens, fuentes y animaciones del prototipo (cancha con franjas, marcador estilo estadio, números condensados). Animaciones: gol (destello, número que sube, confeti con los colores del equipo), tarjeta, cambio (la ficha sale y entra), minuto que avanza, línea de tiempo que se arma sola. Respetar `prefers-reduced-motion`.
- **Accesibilidad:** texto mínimo de 12 px a 360 px de ancho, contraste suficiente, controles ≥ 44 px, descripciones para lectores de pantalla.

**D. Un solo visor para todos los partidos simulados.** Un componente `MatchStage` (el mismo de Cartas, Copa semanal, Subasta, Carrera, DT Online y 8a2) que recibe el **mismo modelo** y muestra cancha, eventos y marcador igual que un partido real. Tomar como referencia el `simMatch` del prototipo (22 puntos que se acomodan según la pelota, línea de tiempo, goles con goleador, penales). Reemplaza a `LivePitch`, `MatchPitch` y `MatchSimulator`. DT Online pasa a usar el mismo formato de eventos por su WebSocket.

**E. Conexión con el rediseño (lo que depende de esto).**
- **Partidos temáticos (sección 2.3):** la **previa** muestra la **alineación probable**; el día del evento, una franja con el **marcador real en vivo** en Hoy; **"Héroe del clásico"**: quien marcó en el partido real tiene una carta especial en el sobre del evento los días siguientes; **"El día después"** y el **pronóstico** se resuelven con el resultado real; el **duelo de hinchadas** puede mostrarse junto al marcador.
- **Detección de eventos** con el calendario (`getFixturesByDate`).
- **Marcador y alineación** reutilizables en el muro del club ("Juan acaba de sacar 82", "gol de Colo-Colo").
- **Partido de cartas, 8a2 y copa:** mismos eventos y mismo visor.

### 14.4 Criterios de aceptación
1. Con un partido real en vivo: el marcador y el minuto se actualizan en menos de 30 s sin recargar; los goles y tarjetas aparecen en la línea de tiempo con minuto y autor.
2. La alineación se ve **correcta** (formación, posiciones, DT, banca, cambios) en ESPN **y** en api-football, aunque falten campos. Probada con respuestas guardadas.
3. Se lee bien a **360 px** de ancho (texto ≥ 12 px) y en computador.
4. Una sola implementación de cancha y de eventos en toda la app. Se borran `LivePitch`, `MatchPitch`, `MatchSimulator` y el CSS duplicado.
5. Si la fuente falla, la pantalla lo dice y no muestra datos viejos como actuales.
6. Los partidos temáticos funcionan de punta a punta con partidos reales (probar con un clásico real o con una grabación).
7. Tests: normalizador, mapa de posiciones, inferencia de formación, reconexión y reproducción de una grabación de partido.

### 14.5 Orden sugerido dentro de la fase 4b
1. Paso 0: reproducir y guardar respuestas reales; listar los bugs confirmados.
2. Modelo único y normalizadores con pruebas.
3. Consultor compartido + SSE/WebSocket + aviso de gol.
4. Interfaz nueva: tarjeta, línea de tiempo, alineación, estadísticas.
5. `MatchStage` y migración de Cartas, Copa semanal, Subasta, Carrera, DT Online y 8a2.
6. Borrar lo viejo.
7. Conectar con los eventos temáticos.

---

## 15. Resumen de una línea
Futotal pasa de "muchos juegos sueltos y puntos confusos" a **un partido del día igual para todos, que suma al instante a un club con temporada**, con juegos fusionados, cartas con SBC temáticos, partidos de evento con identidad propia, ADN futbolero y un primer ingreso que enseña jugando.
