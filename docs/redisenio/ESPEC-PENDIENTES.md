# Futotal 2.0 · Especificación de lo que falta

Para ejecutar sobre `main` (commit 9bcec9c) sin preguntarle nada al dueño. Complementa a
`LEEME-IMPLEMENTACION.md` (el plan) y a `ESTADO-IMPLEMENTACION.md` (lo que ya está hecho).
Este documento no tiene código: dice qué construir, en qué orden y cómo saber que quedó.

Cada punto trae cuatro partes: **decisión final**, **pasos ordenados**, **criterios de terminado** y **riesgos**.

---

## 0. Antes de empezar

### 0.1 Lo que ya está decidido (no volver a preguntarlo)

| Tema | Decisión vigente |
|---|---|
| Juegos libres y puntos (punto 10 del ESTADO) | **Decidido (D13).** Los juegos libres suman al club **solo en clubes Total**. En Clásico, en pretemporada o sin club, la pantalla muestra lo que habría ganado con la nota «en tu club no suma». Se mantiene la fuente `libre:<juego>`. La frase «diversión nunca da puntos» del código viejo quedó obsoleta. |
| Simulación del 8a2 | **Decidido («no hagas el H4»).** El 8a2 conserva su propia simulación de partidos. Del 7a0 se copia solo **cómo eliges** (flujo y diseño), no la simulación ni los equipos de la Champions. |
| Cotrero | **Decidido.** Simple = estructura de Copero; medio = estructura de El Ídolo (Potrero). Se mantienen los colores de Futotal. No se copian marcas, logos ni textos de esos sitios. |
| Tope y frecuencia de los juegos libres | **Decidido.** Una vez por juego y por día, con tope de 100 al día por club. |
| Venta automática de repetidas (J1) | **Descartada.** Las repetidas se venden a mano o se usan en desafíos de plantilla (SBC). |
| W4, W8, W9, K5, L4, S8 y todo el bloque O | **Descartados.** No reaparecen en nada de lo que sigue. |
| W7 (álbum de selecciones) | **Aprobado.** Se especifica en el punto 4.5. |
| Dificultad del Partido del día | **Decidido.** Es igual para todos. No hay variantes por dificultad en lo que da puntos base. |

### 0.2 Dos fallas en `main` que se arreglan primero (paso 0 de todo)

**F1 · El juego diario viejo le quita los puntos al Partido del día.**
- Dónde está: `server/utils/daily-games.js:92`. `recordDailyResult` acredita la fuente `partido_dia` cuando el juego es el «diario rotativo» de hoy.
- Choque: el Partido del día nuevo (`server/routes/daily-match.js:115`) usa la misma fuente.
- Por qué pierde el Partido del día: el libro tiene `UNIQUE (user_id, group_id, date, source)` con `INSERT OR IGNORE`.
- Ejemplo: si alguien juega primero el diario viejo (Escudos «diario», Un Minuto «diario», `draft-europeo.html?diario=1`, Fichado, etc.), sus 0–100 ocupan `partido_dia`. El Partido del día real ya no acredita. Además, la racha (`server/utils/streak.js:34`) cuenta un día que no se jugó el Partido del día.
- Arreglo:
  - Con `FUTOTAL2=1`, `recordDailyResult` **siempre** toma la rama de práctica: sobre de práctica más la fuente `libre:<juego fusionado>`.
  - Nunca escribe `partido_dia`, `daily_game_results` ni el sobre del diario rotativo.
  - Sin la bandera se comporta como hoy.
- Prueba obligatoria:
  1. Club Total con temporada iniciada.
  2. Jugar el juego que hoy sería el «diario rotativo».
  3. Jugar el Partido del día.
  4. Verificar que el Partido del día acreditó su puntaje completo (×2) y que el diario viejo quedó como `libre:*`.

**F2 · Las fuentes `versus`, `draft`, `carrera` y `dt_podio` no se acreditan en ninguna parte.**
- Están definidas en `server/utils/ledger.js` (`FLAT_POINTS`, `DT_PODIO_POINTS`), pero no hay ninguna llamada a `creditPoints` con esas fuentes.
- Hoy un club Total nunca recibe esos puntos.
- Se arreglan dentro de los puntos 1 y 2 (ver 1.4 y 2.4). `dt_podio` se acredita en el cierre semanal de DT Online como paso 1.0.9.

---

## 1. Fusión de juegos (sección 2.4 y Fase 3)

### 1.1 Decisión final

**Estructura común a todos los juegos fusionados**

- Ruta nueva: `/jugar/<juego>` y `/jugar/<juego>/<variante>`.
  - Sin variante, se abre la última que usaste. Se guarda en `localStorage` con la clave `fq2_variante:<juego>`.
  - Si nunca jugaste, se abre la primera variante de la tabla.
- Una sola pantalla de entrada por juego:
  - Arriba: chips de variante.
  - Al medio: la tarjeta de la variante, con un botón **Jugar** y una demo animada de 10 s sin texto (la misma demo del «?» que ya existe).
  - Abajo: pestaña **Récords**.
- Pantalla de resultado común (`ResultadoJuego`). Muestra:
  - Aciertos (barra de 5 pelotas, igual que en el Partido del día).
  - Lo que sumó al club, sacado de `club.credited` que devuelve el servidor.
  - En Clásico, en pretemporada o sin club: «Habrías sumado N · en tu club no suma» (`club.wouldHave`).
  - Si ya jugaste ese juego hoy: «Ya sumaste hoy en <juego> · esta es de práctica».
  - El sobre de práctica, si salió («te quedan N hoy»).
  - Botones **Otra vez** y **Compartir**.
  - El ADN: cada juego alimenta su área (tabla 1.2).
- **Récords:** se leen de las fuentes que ya existen. **No se cambia ninguna clave** de `localStorage` (`futgames:<juego>:stats`, `quien_es_diario`, `mentiroso_stats`, etc.) ni ninguna tabla. La pestaña Récords une lo que ya hay.
- **Partidas guardadas:** cada variante conserva su guardado actual (misma clave, misma ruta del servidor). Si hay una partida a medias, la tarjeta muestra **Continuar** en vez de **Jugar**.
- **El «diario rotativo» se retira.**
  - Las variantes que tenían modo «Del día» lo conservan solo como **semilla compartida**: todos ven el mismo desafío y hay ranking del día entre los del club.
  - Ese modo no tiene puntos ni sobre especiales: cuenta igual que cualquier partida libre.
  - El único juego diario con puntos base es el Partido del día.

**Clave de puntos por juego fusionado.** El servidor traduce la clave de la variante a la del juego fusionado, de modo que `libre:<juego>` sea «una vez por juego al día» (no por variante).

| Clave que envía hoy el cliente o el servidor | Juego fusionado (fuente) |
|---|---|
| `fichado`, `quien_es`, `traspasos` | `libre:quien_es` |
| `escudos`, `torta` | `libre:que_club` |
| `piramide`, `a_quien_me_compro` | `libre:mas_o_menos` |
| `un_minuto`, `supervivencia`, `trivia` | `libre:trivia` |
| `arbitraje_var` | `libre:var` |
| `tateti`, `bingo` | `libre:bingo` |
| `cotrero`, `cotrero_medio` | se dejan de enviar (los puntos de Cotrero pasan por `carrera`, punto 2) |
| `draft_europeo` | se deja de enviar (los puntos del Draft pasan por `draft`, 1.2.7) |

**Puntos de una partida libre:** `aciertos × 4`, con un máximo de 20. Los aciertos son `round(fracción × 5)`, que es lo que ya hace el código. Solo cuenta la primera partida del día de ese juego fusionado. Tope de 100 al día por club (ya implementado). Solo en Total.

**Sobres:** sin cambios. Hasta 3 sobres de práctica por día en total (no por juego). La calidad depende de la fracción, más un escalón por nivel (difícil +1, demonio +2) y otro por duración de 180 s o más.

### 1.2 Juego por juego

Para cada juego: qué entra, qué se descarta, pantallas, reglas, cómo se calcula la fracción, guardados y récords.

#### 1.2.1 ¿Quién es? (`/jugar/quien-es`)

| Variante | Viene de | Qué se conserva | Fracción |
|---|---|---|---|
| **Parecido** (`/parecido`) | Fichado (`Wordle.jsx`, `/api/wordle/*`) | Dificultades, filtro de ligas, pistas, la lógica del servidor | La que ya calcula el **servidor** (`wordle.js:341`): `min(1, puntaje / 23)` si ganó (`FICHADO_DAILY_BEST`); 0 si perdió. Hoy solo se reporta en modo `daily`: con la fusión se reporta en **todos** los modos (por la rama de práctica) |
| **Carrera** (`/carrera`) | ¿Quién es? (`QuienEs.jsx`, `/api/quien-es/*`) | Pistas de trayectoria en orden | `1 − (pistasUsadas − 1) / pistasTotales` si acertó; 0 si no |
| **Traspasos** (`/traspasos`) | Traspasos a ciegas (`Traspasos.jsx`, `/api/traspasos/*`) | 6 intentos, guardado actual | `(6 − intentos) / 5`, con mínimo 0, si acertó; 0 si no |

- **Se descarta:**
  - El reto semanal de Fichado (sale de la interfaz; la tabla queda para la limpieza del punto 4).
  - El modo «Del día» de Fichado como fuente de puntos: queda como semilla compartida.
- **¿Quién es? en vivo** no entra aquí: es un modo de Versus.
- **Pantalla de variante:**
  - Tarjeta con la silueta del jugador.
  - Selector de dificultad (solo en Parecido: Fácil, Normal, Difícil, como hoy).
  - Botón Jugar.
  - Dentro del juego no cambia nada visual, salvo que el encabezado pasa a ser el del juego fusionado, con chips de variante desactivados mientras hay una partida en curso.
- **Récords:** victorias, racha y promedio de intentos por variante, con los datos actuales de cada página.

#### 1.2.2 ¿Qué club? (`/jugar/que-club`)

| Variante | Viene de | Modos | Fracción |
|---|---|---|---|
| **Escudos** (`/escudos`) | `CrestQuiz.jsx` | Fácil, Experto y «Del día» (semilla compartida). Se agrega Medio: escudo con desenfoque y sin colores | `aciertos / 5` |
| **Plantel** (`/plantel`) | Torta de plantel (`Torta.jsx`, `/futgames/squad`) | Como hoy | `(4 − intentos) / 3`, con mínimo 0, si acertó; 0 si no |

- Escudos hoy calcula el resultado en el cliente. **Se mantiene así** en esta fase: el riesgo está en 1.4. Hoy el modo diario usa `weighted / ROUNDS`; con la fusión **todos** los modos usan `aciertos / 5`. El nivel solo sube la calidad del sobre (Experto = difícil).

#### 1.2.3 Más o menos (`/jugar/mas-o-menos`)

| Variante | Viene de | Fracción |
|---|---|---|
| **¿A quién me compro?** (`/compro`) | `AQuienMeCompro.jsx` (lo decide el servidor) | `correctas / 10` |
| **Pirámide** (`/piramide`) | `Piramide.jsx` (`/futgames/pyramid`) | `posiciones correctas / 10` |

- Pantalla de variante: dos tarjetas enfrentadas (Más / Menos) como ilustración animada. Los modos internos de cada variante (`MODES` de AQMC) siguen como chips secundarios.

#### 1.2.4 Trivia (`/jugar/trivia`)

| Variante | Viene de | Modos | Fracción |
|---|---|---|---|
| **Un minuto** (`/un-minuto`) | `UnMinuto.jsx` | Niveles difícil, ultra y demonio, con 50/50 como hoy. «Del día» (ultra, semilla compartida) | `min(1, puntaje / DAILY_TARGET)` |
| **Supervivencia** (`/supervivencia`) | `Survival.jsx` (`/duels/random-set`) | Como hoy | `min(1, racha / 15)` |

- La **Trivia vieja** (`/trivia`, `Trivia.jsx`, banco de preguntas de grupo) **no** entra: se borra en el punto 4.
- Si alguien envía la clave `trivia` (partidas a medias en caché), se mapea a `libre:trivia` hasta la limpieza.

#### 1.2.5 VAR (`/jugar/var`)

| Pestaña | Viene de | Puntos |
|---|---|---|
| **Árbitro** | `ArbitrajeVar.jsx` (lo decide el servidor). Interruptor «Con reloj» (el modo cronometrado actual) | `correctas / rondas` → `libre:var` |
| **Votación del club** | `VarVotacion.jsx` (`/arbitraje-var/vote`) | **Sin puntos.** Tras votar se ve el reparto del club y el global |

- La votación es una pestaña y no una variante, porque no se «gana». Tampoco gasta el «una vez al día».

#### 1.2.6 Bingo (`/jugar/bingo`)

- Sin cambios de juego. Fracción: `casillas puestas / 9`. `/tateti` ya redirige a `/bingo`; ambas pasan a `/jugar/bingo`.

#### 1.2.7 Versus (`/versus`, ya con ruleta)

- **Modos de la ruleta** (5 porciones): Duelo (`/duelos`), Mentiroso (`/mentiroso.html`), Equipo-Jugador, ¿Quién es? en vivo y Dorsal histórico.
  - Hoy la quinta porción es «Mentiroso y más» → `/quien-sabe-mas`. Se cambia por **Mentiroso** directo.
  - `/quien-sabe-mas` se elimina como pantalla:
    - Subasta pasa al Draft.
    - Supervivencia pasa a Trivia.
    - Votación del VAR pasa a VAR.
    - El resto ya está en la ruleta.
- **Elegir sin ruleta:** debajo de la ruleta, una fila de chips «Elegir modo» para quien no quiere azar.
- **Rival:**
  - Primero, gente del club conectada (presencia que ya existe en el WebSocket).
  - Si no hay nadie, se ofrece **Duelo asíncrono**: juegas tus preguntas ahora y el rival las juega cuando entra.
  - Los otros modos necesitan a los dos conectados y aparecen con el candado «nadie conectado».
- **Puntos `versus` = 30** (fuente fija, solo Total, una vez al día, dentro del tope de 100). Se acreditan **solo cuando el servidor da por cerrada la partida**, con dos usuarios distintos y un ganador que decide el propio servidor:
  - Duelo: al cerrar el duelo en el servidor.
  - ¿Quién es? en vivo y Equipo-Jugador: en el WebSocket, al emitir el final.
  - Dorsal: si el ganador lo decide el servidor, igual que los anteriores. Si lo decide el cliente, como Mentiroso.
  - Mentiroso (reporta el cliente por `/api/online-games/win`): acredita solo si **los dos** jugadores reportan el mismo ganador para el mismo id de partida en menos de 2 minutos. Si no coinciden, nadie suma.
- Recibe los 30 **el ganador**. El perdedor recibe 0.

#### 1.2.8 Draft (`/jugar/draft`)

| Variante | Viene de | Qué es |
|---|---|---|
| **Solo** (`/solo`) | `draft-europeo.html` (8a2), **reescrito en React** | Flujo de elección del 7a0: eliges formación, después cada puesto entre 3 cartas y vas viendo la cancha llenarse con animación por carta. Se conservan las 8 formaciones, los modos Clásico (valoraciones ocultas, 1 cambio) y De almanaque (3 cambios), los estilos de juego, los 138 planteles y **la simulación propia del 8a2** (con penales) y su cuadro eliminatorio |
| **Copa 8a2** (`/copa`) | `Copa8a2.jsx` | Como hoy, dentro de la carcasa |
| **Subasta** (`/subasta`) | `Subasta.jsx` | Como hoy, dentro de la carcasa |
| **Contra un amigo** (`/amigo`) | Multijugador en línea del 8a2 | Mismo flujo de elección por turnos, en línea |

- **Se descarta:**
  - «Pasar el teléfono» (multijugador en un solo aparato): casi no se usa y duplica «Contra un amigo». Si el dueño quiere conservarlo, basta con decirlo y se agrega como quinta variante sin tocar nada más.
  - El reto semanal Bayern 2020.
- **La simulación del 8a2 se lleva al servidor sin cambiar sus fórmulas.** La función de simular partido del html se porta literalmente a un módulo del servidor. El cliente manda el XI elegido. El servidor simula el cuadro con una semilla y devuelve los partidos en el formato `SimMatch` (punto 3), que el visor anima.
  - Prueba dorada: con la misma semilla, el puerto da exactamente el mismo resultado que el html original.
- **Puntos `draft` = 30:** al salir **campeón** en Solo o en Copa (lo decide el servidor), o al ganarle a un amigo en línea (lo decide el servidor). Subasta suma `draft` solo si su resultado ya lo calcula el servidor. Si lo calcula el cliente, no suma hasta moverlo. Una vez al día entre todas las variantes.
- **Guardado:** la partida en curso del 8a2 (`continuar=1`) se migra. Si hay un guardado viejo del html en `localStorage`, al abrir `/jugar/draft/solo` se ofrece «Terminar tu draft anterior», que abre la versión de `/legacy` hasta que pasen 30 días (punto 4).

### 1.3 Redirección de rutas viejas sin romper links

- **Tabla única de redirecciones** en el cliente, para las rutas de React, y en Express, para los `.html` estáticos. Se conserva la *query* salvo `diario=1`, que se traduce a la variante con su modo «Del día» (semilla compartida).

| Ruta vieja | Ruta nueva |
|---|---|
| `/fulbodle` | `/jugar/quien-es/parecido` |
| `/quien-es` | `/jugar/quien-es/carrera` |
| `/traspasos` | `/jugar/quien-es/traspasos` |
| `/escudos` | `/jugar/que-club/escudos` |
| `/torta` | `/jugar/que-club/plantel` |
| `/piramide` | `/jugar/mas-o-menos/piramide` |
| `/a-quien-me-compro` | `/jugar/mas-o-menos/compro` |
| `/un-minuto` | `/jugar/trivia/un-minuto` |
| `/supervivencia` | `/jugar/trivia/supervivencia` |
| `/arbitraje-var` | `/jugar/var` |
| `/var-votacion` | `/jugar/var?tab=votacion` |
| `/bingo`, `/tateti` | `/jugar/bingo` |
| `/copa-8a2` | `/jugar/draft/copa` |
| `/subasta` | `/jugar/draft/subasta` |
| `/draft-europeo.html` (con o sin `continuar=1`) | `/jugar/draft/solo` (con `continuar=1` se abre el guardado) |
| `/quien-sabe-mas` | `/versus` |
| `/cotrero.html` | `/jugar/cotrero` (punto 2) |
| `/cotrero-medio.html` | `/jugar/cotrero/medio` |
| `/mentiroso.html` | se queda; la ruleta enlaza ahí |

- **Duelos, Equipo-Jugador, ¿Quién es? en vivo y Dorsal** conservan su ruta: son destinos de la ruleta y hay links de invitación compartidos por WhatsApp que apuntan a ellas.
- **Código HTTP:** 302 mientras dura el despliegue gradual y 301 recién después de la limpieza (punto 4, etapa B). Con 301 los navegadores lo guardan y es difícil volver atrás.
- **Los `.html` viejos** se mueven a `client/public/legacy/` y siguen accesibles **solo** desde los botones «Terminar tu partida anterior», durante 30 días. Las redirecciones de Express van **antes** del middleware de archivos estáticos.
- **Service worker:** se sube la versión del caché de `sw.js` en el mismo despliegue que mueve los `.html`. Si no, los teléfonos con la app instalada seguirían abriendo el html viejo desde su caché.
- **Avisos push y `sitemap.xml`:** se actualizan las URL en el mismo despliegue.

### 1.4 Puntos y sobres: resumen de reglas (para las pruebas)

- `partido_dia` sale **solo** del Partido del día.
- `libre:<juego fusionado>`: 4 por acierto, máximo 20, una vez por juego al día, solo Total, tope de 100 al día por club.
- `versus` 30, `draft` 30 y `carrera` 20: misma familia «libre» (solo Total, una vez al día, dentro del tope de 100), y solo los acredita el servidor cuando él decide el resultado.
- En Clásico, en pretemporada, para socios que debutan el mes siguiente o sin club: nada suma, y la pantalla de resultado muestra `wouldHave`.
- Sobres de práctica: 3 al día en total, sin cambios.

### 1.5 Pasos ordenados

1. **Paso 0:** arreglo F1 con su prueba. Pasar a producción solo.
2. **Infraestructura común:**
   - Carcasa `/jugar/:juego/:variante`.
   - `ResultadoJuego` y pestaña Récords.
   - Traducción de clave → juego fusionado en el servidor.
   - Tabla de redirecciones.
   - Interruptor por juego para el despliegue: variable `FUTOTAL2_JUEGOS` con la lista de juegos fusionados activos (`bingo,que_club,…`). Un juego que no está en la lista sigue con su ruta vieja y sin redirección.
   - Pruebas del servidor de la traducción y del «una vez por juego fusionado».
3. **Bingo:** es el más simple; valida la carcasa sin variantes.
4. **¿Qué club?:** primero con dos variantes; agrega el Escudos Medio.
5. **Más o menos.**
6. **VAR:** primero con pestañas en vez de variantes.
7. **Trivia.**
8. **¿Quién es?:** tres variantes; Fichado es lo de más tráfico.
9. **Versus:** cambio de la porción, chips, Duelo asíncrono y acreditación de `versus`.
10. **Draft:** necesita el visor del punto 3 terminado, y además portar la simulación al servidor y reescribir el 8a2 en React. Es lo más grande; va al final.
11. Actualizar `Jugar.jsx`: cada tarjeta apunta a `/jugar/<juego>` y los chips de variante a `/jugar/<juego>/<variante>`. Quitar los enlaces viejos.

Cada juego es un despliegue aparte: se agrega a `FUTOTAL2_JUEGOS`, se prueba en producción con la cuenta del dueño y después se abre.

### 1.6 Criterios de terminado (por juego)

- Se juega entero en 375 px de ancho sin desplazamiento horizontal, y en escritorio.
- Cada link viejo de la tabla 1.3 llega a la variante correcta, también con la *query* (prueba de Playwright que recorre la tabla completa).
- Récords: un usuario con historial previo ve los mismos números antes y después (comparar contra capturas tomadas antes del cambio).
- Una partida a medias anterior al cambio se puede terminar.
- En un club Total:
  - La primera partida del día del juego suma `aciertos × 4`.
  - La segunda (de cualquier variante del mismo juego) suma 0 y muestra «ya sumaste hoy».
  - En un club Clásico, nada suma y aparece «habrías sumado N».
- El Partido del día suma completo aunque antes se haya jugado cualquier juego libre (prueba de F1).
- Sin errores en la consola. `npm test` en verde, con pruebas nuevas del servidor para la traducción de claves, Versus (coincidencia de reportes) y Draft (prueba dorada de la simulación).

### 1.7 Riesgos

- **Resultados que calcula el cliente** (Escudos, Plantel, Pirámide, Supervivencia, Bingo y Un Minuto con ayuda del cliente) se pueden falsificar. Están acotados a 20 por día y por juego, dentro del tope de 100.
  - Mitigación ahora: el servidor rechaza una fracción con una duración imposible (menos de 15 s para 5 rondas).
  - Mitigación después: mover el cálculo al servidor de a un juego (fuera de este alcance).
- **Cambiar claves de guardado** borra récords en silencio. Regla: ninguna clave de `localStorage` ni tabla cambia de nombre en este punto.
- **Caché del service worker y links de WhatsApp:** cubiertos con la subida de versión y el 302.
- **Reescribir el 8a2** es el cambio más riesgoso (el html tiene unas 2.560 líneas). Mitigación:
  - Prueba dorada de la simulación.
  - Mantener el html en `/legacy` 30 días.
  - Abrirlo primero solo a la cuenta del dueño.

---

## 2. Cotrero renovado

### 2.1 Decisión final

- **Un solo motor de carrera en el servidor** para las dos versiones. El teléfono solo muestra el estado y manda la elección. El puntaje lo calcula el servidor, y así «Leyendas del club» deja de depender de lo que diga el teléfono.
- **Cotrero (simple)** = estructura de Copero:
  - Eliges ritmo (**Intensa**, **Normal** o **Exprés**).
  - Creas el jugador.
  - Cada temporada (o bloque de temporadas) se resuelve con una o dos decisiones y un resumen.
  - Terminas en el retiro con un legado.
- **Cotrero medio** = estructura de El Ídolo:
  - Delantero o enganche.
  - Pretemporada con atributo a entrenar.
  - Eventos que mueven tu **reputación**.
  - Partidos clave con minijuego.
  - **Convocatoria** a la selección.
  - Ofertas de fichaje.
  - **Resumen final** con figura histórica parecida.
- Ruta: `/jugar/cotrero` (simple) y `/jugar/cotrero/medio`. Va en la sección «Carrera» de Jugar.
- **Puntos:** al **terminar** una carrera, fuente `carrera` = 20 (solo Total, una vez al día). Además, sobre de práctica con fracción `min(1, puntaje / 1400)`, dentro de los 3 al día.

### 2.2 Motor y servidor

- **Tabla `careers`**, con estas columnas:
  - `id`
  - `user_id`
  - `game` (`cotrero` o `cotrero_medio`)
  - `mode` (`intensa`, `normal`, `expres`; vacío en medio)
  - `seed`
  - `step`
  - `state_json`
  - `status` (`activa`, `terminada`, `abandonada`)
  - `score`
  - `label`
  - `created_at`
  - `finished_at`
- Cada usuario tiene como máximo una carrera activa por juego. Empezar otra marca la anterior como `abandonada`.
- **Azar con semilla:** cada tirada sale de un generador con `semilla + paso + n° de tirada`. La misma carrera repetida con las mismas elecciones da lo mismo, y así se puede probar y auditar.
- **Endpoints:**
  - `POST /api/careers/start`: recibe `{ game, mode, jugador }` y devuelve el estado y la primera decisión. Máximo 10 inicios por usuario y día (respuesta 429 con «mañana más»).
  - `GET /api/careers/active?game=`: devuelve el estado si hay una carrera activa. Así se puede continuar desde otro teléfono.
  - `POST /api/careers/:id/act`: recibe `{ step, choice }` y devuelve `{ estado, eventos }`.
    - Si `step` no coincide con el paso actual, responde 409 con el estado actual. Esto evita el doble toque y el volver atrás.
    - Reenviar el mismo paso con la misma elección devuelve la misma respuesta.
    - `eventos` es la lista que la pantalla anima: goles de la temporada, título, lesión, fichaje.
- **Al terminar**, el servidor:
  1. Calcula el puntaje y la etiqueta.
  2. Hace un *upsert* en `career_scores` **solo si mejora**, con la columna nueva `verified = 1`.
  3. Acredita `carrera` 20.
  4. Da el sobre de práctica.
  5. Devuelve «mejor que el X% de tu club», calculado sobre las carreras verificadas de los socios.
- **El endpoint viejo `POST /api/careers/score`:**
  - Durante 30 días sigue aceptando datos de los html de `/legacy`, guardados con `verified = 0`.
  - **Nunca** pisa una fila con `verified = 1`.
  - Después, responde 410.
- **«Leyendas del club»:** muestra primero las carreras verificadas. Las viejas sin verificar aparecen con una etiqueta gris «sin verificar» hasta que el socio hace una verificada mejor. No se borra ninguna.

### 2.3 Cotrero simple

**Pantallas**

1. **Inicio:**
   - Botón «Nueva carrera».
   - Tres chips de ritmo:
     - Intensa: unos 10 min, dos decisiones por temporada.
     - Normal: unos 5 min, una por temporada.
     - Exprés: unos 2 min, una cada 3 temporadas.
   - «Continuar» si hay una carrera activa.
   - «Récords»: tu mejor puntaje y Leyendas del club.
2. **Crear jugador:**
   - Apellido: 2 a 14 letras, con filtro de groserías.
   - Número: 1–99.
   - Pie: diestro, zurdo o ambidiestro. Ambidiestro empieza con −2 de valoración y +5% de goles.
   - Nacionalidad: Chile, Argentina, Uruguay, Perú, Colombia, Brasil, Paraguay, Ecuador, Venezuela, Bolivia, España o Italia. Define la liga del primer club.
   - Posición: arquero, defensa, medio o delantero.
   - Perfil: velocidad, técnica o físico. Velocidad da +10% de goles y −1 año de retiro; técnica, +15% de asistencias; físico, −30% de lesiones.
   - Vista previa de la carta animada mientras se completa.
3. **Temporada (centro de la carrera):**
   - Carta del jugador: edad, valoración (número grande), club, escudo y nivel del club.
   - Línea de tiempo con las temporadas jugadas.
   - Botón «Jugar temporada» (o «Jugar bloque» en Exprés).
4. **Decisión:** carta con la situación y 2–3 opciones. Cada opción muestra íconos de efecto (↑ valoración, ↑ minutos, riesgo de lesión, ↑ títulos) **sin números**.
5. **Resumen de temporada o bloque:**
   - Partidos, goles, asistencias (o vallas invictas) y títulos, contados de 0 al valor.
   - Valoración que sube o baja.
   - Premio, si hubo.
6. **Fichaje:** aparece si hay ofertas (0–3 tarjetas). Cada una muestra club, nivel y minutos esperados (titular, rotación o suplente). Siempre está «Quedarme».
7. **Retiro y legado:**
   - Totales y títulos.
   - Etiqueta y puntaje.
   - «Mejor que el X% de tu club».
   - Botones «Compartir» y «Nueva carrera».

**Modelo**

- **Inicio:** 17 años. Valoración inicial `55 + azar(0..5)`. Potencial oculto `70 + azar(0..24)`.
- **Progresión por temporada:**
  - Crecimiento según la edad:
    - Hasta 21 años: +2 a +4.
    - De 22 a 27: 0 a +2.
    - De 28 a 30: −1 a +1.
    - Desde 31: −3 a −1.
  - Se multiplica por el factor de minutos: titular 1,0; rotación 0,7; suplente 0,4.
  - Si la valoración ya llegó al potencial, el crecimiento positivo se vuelve 0.
  - Los efectos de las decisiones se suman después.
- **Niveles de club**, según la valoración mínima para que te ofrezcan:

| Nivel | Valoración mínima | Ejemplo de liga |
|---|---|---|
| 1 | — | Chile, Bolivia, Perú |
| 2 | 64 | Argentina, Brasil, MLS |
| 3 | 72 | Europa media |
| 4 | 80 | Europa grande |
| 5 | 86 | Élite |

  Los clubes salen de las listas que ya trae `cotrero.html`.
- **Rol en el club:**
  - Titular si la valoración ≥ mínima del nivel + 4.
  - Rotación si está entre la mínima − 4 y la mínima + 4.
  - Suplente si es menor.
- **Partidos por temporada:** titular 30–38; rotación 18–28; suplente 5–14.
- **Goles y asistencias** (una tirada por partido, con probabilidad):

| Posición | Gol por partido | Asistencia por partido |
|---|---|---|
| Delantero | `0,25 + (val − 60) × 0,012` | `0,12` |
| Medio | `0,08 + (val − 60) × 0,005` | `0,18 + (val − 60) × 0,006` |
| Defensa | `0,03` | `0,05` |
| Arquero | 0 | 0 |

- **Vallas invictas** (solo defensa y arquero): `partidos × (0,20 + nivel × 0,06)`.
- **Títulos:**
  - Liga: probabilidad por nivel 0,05 / 0,12 / 0,20 / 0,30 / 0,40, por el factor de rol (1 / 0,8 / 0,5).
  - Copa internacional (solo nivel 3 en adelante): 0,06 / 0,12 / 0,20.
- **Premios:**
  - «Mejor del torneo»: si la valoración ≥ mínima del nivel + 8, con probabilidad 0,25.
  - «Mejor del mundo»: solo con valoración 90 o más, en nivel 5, con probabilidad 0,30.
- **Lesiones:** probabilidad por temporada de 0,12 + 0,03 por cada año sobre 30. Una de cada 4 es grave: −30% de partidos y −1 a −3 de valoración.
- **Retiro:**
  - Forzado a los 38.
  - Desde los 33 se ofrece retirarse si la valoración es menor a 70.
  - Automático desde los 30 con valoración menor a 60.
- **Ofertas al final de la temporada:**
  - 0–3 clubes.
  - De nivel ≤ el que permite tu valoración, y como mucho uno por sobre tu nivel actual.
  - Con un año malo (menos de 10 partidos), solo ofertas de nivel igual o inferior.

**Catálogo de decisiones** (mínimo 25; cada una se ofrece cuando se cumple su condición, sin repetirse dentro de 3 temporadas)

| # | Situación (condición) | Opciones → efecto |
|---|---|---|
| 1 | Pretemporada (siempre) | Entrenar fuerte: +1 val., +5% lesión · Normal: nada · Descansar: −5% lesión |
| 2 | Préstamo (suplente, ≤ 22 años) | Ir a préstamo un año: rol titular en un club de nivel −1, ×1,2 de crecimiento · Quedarse |
| 3 | El DT te pide jugar fuera de tu puesto (medio o delantero) | Aceptar: titular, −10% goles · Negarse: rotación |
| 4 | Oferta de afuera grande (val. ≥ mínima del nivel actual + 6) | Irse: nivel +1, primera temporada como rotación · Quedarse: +1 título de prob. ×1,1 |
| 5 | Renovación (cada 3 temporadas) | Renovar: estabilidad, sin ofertas un año · Probar suerte: +1 oferta asegurada |
| 6 | Lesión leve (salió lesión no grave) | Volver antes: +20% partidos, 30% de recaída grave · Recuperarse bien |
| 7 | Lesión grave | Operarse: −1 val. y la temporada siguiente completa · Tratamiento: 50% de recaída |
| 8 | Clásico decisivo (nivel 1–2) | Pedir patear el penal: 70% gol (+título ×1,3) o 30% error (−5% título) · Dejarlo |
| 9 | Selección juvenil (≤ 20 años, val. ≥ 65) | Ir: +2 val., −3 partidos de club · No ir |
| 10 | Pelea con el DT (aleatoria, 8%) | Pedir disculpas · Pedir salir: oferta forzada de nivel igual |
| 11 | Capitanía (≥ 27 años, titular) | Aceptar: +5% títulos · Rechazar |
| 12 | Oferta árabe o china (≥ 30, val. ≥ 75) | Ir: nivel 2 fijo, −1 val. por año · Quedarse |
| 13 | Volver al club de origen (≥ 32) | Volver: rol titular, +10% de puntaje final si sale campeón · Seguir |
| 14 | Cambio de DT (aleatorio, 15%) | Adaptarse: 50% titular o 50% rotación · Pedir préstamo |
| 15 | Partido de despedida (último año) | Jugarlo: +1 premio «Ídolo» si fue más de 5 temporadas en un club · No |
| 16 | Especialista en tiros libres (técnica, val. ≥ 75) | Practicar: +10% goles · No |
| 17 | Arquero: atajador de penales | Estudiar a los pateadores: +10% vallas · No |
| 18 | Defensa: subir a los córners | Sí: +0,03 goles por partido, −5% vallas · No |
| 19 | Rotación por Copa | Pedir jugar la Copa: +10% copa, −10% liga · Aceptar la rotación |
| 20 | Sobrepeso tras las vacaciones (aleatorio, 6%) | Dieta estricta: −5% lesión · Nada: −1 val. |
| 21 | Representante nuevo | Firmar: +1 oferta por año · No |
| 22 | Mercado de invierno (Intensa, mitad de temporada) | Cambiarte en enero: elige una de 2 ofertas · Quedarte |
| 23 | Joven del club te quita el puesto (≥ 31) | Pelear el puesto: 50% titular · Asumir rotación |
| 24 | Final continental (nivel ≥ 3) | Jugar infiltrado: +título ×1,2, 20% lesión grave · Ir al banco |
| 25 | Ofrecen ser jugador-entrenador (≥ 36) | Aceptar: el retiro pasa a ser «con legado», +5% del puntaje · No |

- En **Exprés** solo salen las decisiones 1, 4, 5, 7, 12 y 13. En **Intensa** salen todas, más la 22.

### 2.4 Cotrero medio

**Pantallas**

1. **Inicio:** posición (Delantero o Enganche) y liga de inicio (Chile, Argentina o Uruguay). Crear jugador como en la versión simple (sin posición ni perfil).
2. **Pretemporada:** elegir 1 de 5 atributos para entrenar: Definición, Pase, Regate, Físico o Mentalidad. Cada uno suma +2 a ese atributo.
   - La valoración es la media ponderada de los atributos según la posición:
     - Delantero: Definición 0,4; Regate 0,2; Físico 0,2; Pase 0,1; Mentalidad 0,1.
     - Enganche: Pase 0,4; Regate 0,25; Definición 0,15; Mentalidad 0,1; Físico 0,1.
   - Los atributos arrancan en 50–58 y siguen la curva por edad de la versión simple.
3. **Eventos** (1–2 por temporada, del catálogo de abajo): situación con 2–3 opciones que mueven la **reputación** (−10 a +10) y, a veces, atributos o minutos.
4. **Partido clave** (finales y clásicos; 0–2 por temporada) con un **minijuego**, alternando:
   - Penal: eliges una de 6 zonas.
   - Mano a mano: eliges definir cruzado, picado o gambetear.

   El arquero responde al azar, inclinado según Definición o Regate. Resultado: ±10% de la probabilidad del título y ±3 de reputación.
5. **Convocatoria:**
   - Si la valoración es 74 o más y la reputación −2 o más, aparece «Te convocaron».
   - Ir: +5 de reputación, 20% de lesión que resta partidos al club, y suma el contador «partidos con la selección».
   - Excusarse: −3 de reputación.
6. **Cierre de temporada:** resumen como en la versión simple, más el medidor de reputación y las ofertas (0–3).
7. **Resumen final:**
   - Línea de tiempo de clubes con escudos.
   - Logros: títulos, premios, selección.
   - Etiqueta de reputación, según la reputación final:

| Reputación | Etiqueta |
|---|---|
| +40 o más | Ídolo |
| +15 a +39 | Querido |
| −14 a +14 | Profesional |
| −39 a −15 | Polémico |
| −40 o menos | Villano |

   - **Figura histórica más parecida:** de un archivo curado `server/data/figuras_historicas.json` con unas 30 figuras. Cada una tiene posición, goles por temporada, títulos, temporadas, selección y reputación aproximada. Se elige la más cercana normalizando esas variables.
   - «Mejor que el X%», puntaje, compartir.

**Reputación:** empieza en 0 y se acota entre −50 y +50.

**Catálogo de eventos** (mínimo 20): entrevista después de una derrota, festejo provocador en un clásico, polémica en redes, donación al club de barrio, faltar a un entrenamiento, pelea con un compañero, pedido de aumento, rechazo a un rival histórico, declaraciones sobre el DT, foto con la hinchada rival, aceptar o no la cinta de capitán, visita a un hospital, ir a una fiesta antes de una final, defender a un compañero, irse sin despedirse, volver al barrio, firmar autógrafos tras perder, criticar al árbitro, renunciar a la selección por el club y homenaje a un ídolo.
- Cada evento tiene una opción «correcta» (+), una polémica (−, a veces con premio deportivo) y a veces una neutral.

### 2.5 Puntaje (ambas versiones)

- **Fórmula base** (la que ya usa `cotrero-medio.html`, para no romper la escala de Leyendas):
  `títulos × 45 + premios × 35 + goles × 1,1 + asistencias × 0,9 + partidos × 0,25 + valoraciónMáxima × 6 + temporadas × 3`
- **Arquero y defensa** suman `+ vallas × 0,6` (si no, nunca llegarían a Leyenda).
- **Medio** suma `+ max(0, reputación) × 6` (como máximo +300) y `+ partidosSelección × 2`.
- Simple con «retiro con legado» (decisión 25) o «vuelta al club de origen campeón» (decisión 13): +5% / +10% del total.
- **Etiquetas** (las mismas de `rankingFor`):

| Puntaje | Etiqueta |
|---|---|
| 1400 o más | Leyenda |
| 1000 o más | Ídolo |
| 650 o más | Crack |
| 350 o más | Jugador correcto |
| Menos de 350 | Jugador de paso |

- El tope de 3000 se mantiene.
- **Calibración obligatoria antes de abrirlo:**
  - Simular 10.000 carreras con elecciones al azar por versión y ritmo.
  - Objetivo: Leyenda entre 2% y 6%; Jugador de paso entre 20% y 35%; un Exprés en promedio un 15% por debajo de un Intensa (más decisiones, más control).
  - Si no se cumple, ajustar **solo** las probabilidades de títulos y premios, no la fórmula.

### 2.6 Pasos ordenados

1. Columna `verified` en `career_scores` (las filas actuales quedan en 0). Etiqueta «sin verificar» en Leyendas.
2. Tabla `careers` y motor puro, con pruebas: semilla fija → misma carrera; idempotencia de `act`; 409 si el paso no coincide; límite de 10 al día.
3. Cotrero simple: modelo, catálogo y pantallas. Calibración con 10.000 carreras.
4. Acreditación al terminar: `career_scores` verificado, `carrera` 20, sobre y «mejor que el X%».
5. Cotrero medio sobre el mismo motor: atributos, eventos, minijuegos, convocatoria, resumen y `figuras_historicas.json`. Calibración.
6. Redirecciones de `cotrero*.html` (tabla 1.3). Mover los html a `/legacy`. Botón «Terminar tu carrera anterior» si el `localStorage` tiene una partida guardada vieja (claves `SAVE_KEY` de cada html), activo 30 días.
7. A los 30 días, `POST /api/careers/score` pasa a responder 410.

### 2.7 Criterios de terminado

- Las dos versiones se juegan enteras en 375 px. Exprés en 3 minutos o menos.
- Recargar el teléfono a mitad de carrera, o abrirla desde otro aparato, continúa en el mismo paso.
- Doble toque en una opción no avanza dos pasos (prueba de 409 o idempotencia).
- Un puntaje mandado a mano a `/api/careers/score` no aparece como verificado ni pisa uno verificado.
- La calibración cumple los rangos de 2.5 (el informe de la simulación queda en el PR).
- Club Total: terminar una carrera suma 20 una vez al día. Club Clásico: «habrías sumado 20».

### 2.8 Riesgos

- **Volver a tirar hasta que salga una buena carrera:** es legítimo («jugar otra»), pero se limita a 10 inicios al día. La semilla está en el servidor, así que no se puede predecir.
- **Los jugadores actuales pierden su carrera a medias:** mitigado con `/legacy` durante 30 días.
- **El balance:** sin la calibración, Leyenda puede quedar muy fácil o imposible. Por eso la calibración es requisito para abrir.
- **El catálogo de figuras históricas** usa nombres reales. Solo se ponen nombre y descripción con datos públicos, sin fotos ni escudos de marca.

---

## 3. Visor único de partidos simulados (14.3 D)

### 3.1 Decisión final

- **Un componente, `MatchStage`, y un formato, `SimMatch`.** Todo partido simulado del sitio (Cartas, Copa semanal, Subasta, Draft, Carrera DT y DT Online) se muestra con él.
- Comparte las piezas del partido real en vivo (`PartidoVivo`): **Marcador**, **Línea de tiempo** y **Cancha**.
- Los motores **no cambian**. Cada uno tiene un adaptador que traduce su salida a `SimMatch`.

### 3.2 Formato `SimMatch`

**Partido**

| Campo | Contenido |
|---|---|
| `id` | Texto |
| `source` | De dónde salió: `sim:cartas`, `sim:copa`, `sim:subasta`, `sim:draft`, `sim:carrera` o `sim:dt` |
| `teams.home` y `teams.away` | `name`, `short` (3 letras), `colors` (principal y secundario), `crest` (url u opcional) e `isMe` (para resaltar al usuario) |
| `lineups` (opcional) | Por equipo: `formation` y lista de `{ name, pos, x, y }`, con coordenadas de 0 a 100 |
| `events` | Lista ordenada por minuto (detalle abajo) |
| `score` | `{ home, away, pens? }` |
| `duration` | 90, o 120 con alargue |
| `stoppage` | Descuento de cada tiempo, opcional |
| `playback` | `{ mode, speed }`: `mode` es `replay` (el partido ya está calculado) o `live` (llegan eventos); `speed` es 1, 2 o 4 |

**Cada evento** tiene:
- `min` y `extra` (descuento, opcional).
- `type`, uno de:
  - `kickoff`
  - `goal`, `own_goal`, `pen_goal`, `pen_miss`
  - `chance`, `save`
  - `yellow`, `red`
  - `sub`, `injury`
  - `ht`, `ft`
  - `shootout_kick`
- `team`: `home`, `away` o vacío.
- `player`, `assist`, `in` y `out` (opcionales).
- `x` e `y` (opcionales; si faltan, la cancha elige un punto plausible según el tipo y el equipo).
- `text` (opcional; si falta, se genera uno).

**Reglas del formato**
- `events` termina siempre en `ft`.
- La suma de los goles de `events` (incluidos los en contra, que suman al rival) es igual a `score`.
- Los penales de la definición van como `shootout_kick` con `scored`, después de `ft` del alargue.

### 3.3 Componente

**Entradas de `MatchStage`**
- `match`.
- `live`: si es verdadero, los eventos se agregan desde afuera.
- `onDone`: se llama **una sola vez** al terminar o al saltar.
- `controls`: muestra o no los botones x1, x2, x4 y «Saltar».
- Un espacio para hijos, donde la Carrera DT pone sus controles interactivos (tácticas, cambios, presión).

**Qué anima**
- **Gol:** pelota a la red, destello del color del equipo, el marcador salta y la línea de tiempo agrega el ícono.
- **Ocasión:** flecha y «¡Peligro de X!». Si es `save`, aparece la mano.
- **Tarjetas:** tarjeta que cae con giro.
- **Cambio:** flechas que entran y salen.
- **Lesión:** cruz.
- **Entretiempo y final:** cartel que barre la pantalla.
- **Definición por penales:** fila de 5 círculos por equipo.

**Ritmo**
- x1: unos 90 ms por minuto, como `MatchPitch` hoy; eventos con pausa de 900 ms.
- x2 y x4: proporcionales.
- «Saltar» lleva al final y muestra el resumen.

**Movimiento reducido:** con `prefers-reduced-motion`, sin animaciones de movimiento; los eventos aparecen en la línea de tiempo con un fundido.

**Rendimiento:** solo `transform` y `opacity`, nada de *layout*. 60 cuadros por segundo en un teléfono de gama media (prueba con 4× CPU throttling en Chrome).

### 3.4 Adaptadores por pantalla

| Pantalla | Hoy | Adaptador |
|---|---|---|
| Cartas (`Cartas.jsx:476`) y Copa semanal (`CopaSemanal.jsx:174`) | `MatchPitch` con eventos de `simulateMatchEvents` (`goal`, `half`, `final`) | `half` → `ht`, `final` → `ft`, `goal` → `goal`. **En el servidor** se agrega el `player` del goleador, elegido entre los de la alineación con peso por posición, para que el gol tenga nombre |
| Subasta (`Subasta.jsx:591`) | `LivePitch` con `{ goalsA, goalsB, scorersA, scorersB, minsA, minsB, chances }` | Cada `minsA[i]` / `scorersA[i]` → `goal`. `chances` → `chance` repartidas en los minutos sin gol. Agregar `ht` en el 45 y `ft` en el 90 |
| Draft 8a2 | Simulación dentro del html | La simulación portada al servidor (1.2.7) devuelve `SimMatch` directo |
| Carrera DT (`carrera/components/MatchSimulator.jsx`) | Su propia `LivePitch` interna, interactiva; eventos con `x`, `y`, `scorerId` y tipo `goal`, `shot`, `card` o `injury` | **El motor no se toca.** `MatchStage` en modo `live`: `shot` → `chance` (o `save`), `card` → `yellow` o `red`, `scorerId` → `player` (con el nombre). Los controles de tácticas, cambios y presión van como hijos |
| DT Online (WebSocket `dt-liga/:code/live/:fixtureId`) | Mensajes `kickoff`, `event`, `final` y `speed` | **El protocolo no cambia.** `kickoff` → `MatchStage` con `live`. Cada `event` se traduce con el adaptador de `simulateFixtureEvents` (es el mismo motor que Cartas) y se agrega. `final` → `ft`. `speed` → `playback.speed` (los valores del servidor 0,2 / 0,5 / 1 / 2 se muestran como x0,2 … x2; en vivo no se ofrecen x4 ni «Saltar») |

### 3.5 Qué se borra (solo después de migrar cada pantalla)

- `client/src/components/MatchPitch.jsx`: cuando Cartas y Copa estén migradas.
- `client/src/components/LivePitch.jsx`: cuando Subasta esté migrada.
- La `LivePitch` interna de `MatchSimulator.jsx`, cuando la Carrera DT esté migrada. Se conserva su lógica de motor.
- El dibujo de partido de `draft-europeo.html`: con el html entero en la limpieza.
- El render propio de partido en la vista en vivo de DT Online: cuando DT Online esté migrado.

### 3.6 Pasos ordenados

1. **Extraer** de `PartidoVivo` los componentes Marcador, Línea de tiempo y Cancha, sin cambio visual en el partido real.
   - Verificación: capturas de antes y después de un partido real (o uno guardado en el entorno de pruebas) en 375 y 1280 px.
2. **`MatchStage` + `SimMatch`**, con una página interna `/admin/visor` que reproduce partidos de ejemplo de cada adaptador. Validador del formato: termina en `ft` y la suma de goles coincide con `score`.
3. Cartas y Copa semanal (incluye agregar el goleador en el servidor). Borrar `MatchPitch`.
4. Subasta. Borrar `LivePitch`.
5. DT Online.
6. Carrera DT (es la más delicada, por la interactividad). Borrar la `LivePitch` interna.
7. Draft: entra junto con 1.2.7.

### 3.7 Cómo verificar que cada pantalla quedó igual o mejor

- **Pruebas doradas de datos:** para cada motor, 20 semillas fijas. El `SimMatch` que sale del adaptador tiene **el mismo marcador, los mismos minutos de gol y el mismo ganador** que la salida original.
- **Capturas de Playwright** antes y después, en 375 y 1280 px, en tres momentos:
  - Inicio.
  - Primer gol (se adelanta con «Saltar hasta el evento N» de la página interna).
  - Final.

  Se revisan a ojo y se adjuntan al PR. «Igual o mejor» significa:
  - Siempre se ven el nombre de los equipos y el marcador.
  - Cada gol tiene minuto y autor (donde antes lo tenía).
  - No hay textos cortados.
- `onDone` se llama exactamente una vez, al terminar y también al saltar (prueba unitaria).
- **DT Online:** dos navegadores (los dos DT) y un tercero espectador ven los mismos eventos en el mismo orden. Cambiar la velocidad se refleja en los tres.
- **Carrera DT:** un cambio y un cambio de táctica a mitad de partido siguen funcionando, igual que antes.
- **Rendimiento:** grabación de rendimiento en Chrome con 4× throttling, sin cuadros largos de más de 50 ms durante un gol.

### 3.8 Riesgos

- **La Carrera DT** mezcla motor y dibujo en el mismo componente. Si separarlos no es limpio, la regla es **no tocar el motor**: `MatchStage` solo reemplaza lo visual. Si eso no se puede hacer sin cambiar resultados, la Carrera DT queda fuera y se informa.
- **El goleador inventado en Cartas y Copa** debe salir de la alineación real del usuario. Si no hay alineación, el evento va sin nombre en vez de inventar uno.
- **DT Online en vivo:** si un cliente se reconecta a mitad del partido, hoy recibe los eventos que faltan. `MatchStage` debe aceptar recibirlos todos de una vez sin animar 30 goles seguidos: los que ya pasaron se muestran sin animación.

---

## 4. Limpieza (A7), marcos, logros y álbum de selecciones (W7)

### 4.1 Decisión final

Se borra en **tres etapas**, nunca en una sola. Antes de la primera se guarda todo lo que el usuario «ganó».

| Etapa | Cuándo | Qué se hace | ¿Se puede deshacer? |
|---|---|---|---|
| **A · Ocultar** | Cuando `FUTOTAL2=1` lleva **2 semanas abierto a todos** sin fallas graves | Se quitan los botones y enlaces. Las rutas redirigen (302) a su reemplazo, o a `/`. Los endpoints de **escritura** responden 410 «Este modo ya no está»; los de lectura siguen | Sí: se revierte un despliegue |
| **B · Borrar código** | **30 días** después de la etapa A | Se borra el código de cliente y servidor de cada grupo, **un PR por grupo**. Las redirecciones pasan a 301 | Sí, con `git revert` |
| **C · Borrar tablas** | Solo con una segunda exportación de la base y el OK explícito del dueño en el PR | Se borran las tablas | No. **Por defecto, las tablas se quedan** (pesan poco en Turso) |

Antes de la etapa A, obligatorio:
1. **Exportar** la base de Turso (`turso db shell <db> .dump > respaldo-AAAA-MM-DD.sql`) y guardarla fuera del servidor.
2. **Congelar los logros** (4.3).
3. **Archivar las tablas finales de Fantasy** (4.2).

### 4.2 Inventario y orden

El orden va de lo menos usado a lo más usado, y cada grupo es un PR.

| # | Grupo | Rutas / archivos | Tablas (se quedan salvo etapa C) | Condición extra |
|---|---|---|---|---|
| 1 | Pase de temporada y misiones | `/pase`, `routes/season-pass`, misiones | `season_claims` | Los títulos ya entregados (`user_titles`) **se conservan** y se siguen mostrando |
| 2 | Reto del día y retos semanales | `routes/daily-challenge`, `challenges` (reto semanal de Fichado, Bayern 2020) | `challenge_scores` | — |
| 3 | Rotación del «diario» viejo | `dailyGameKeyFor` y la rama de puntos de `recordDailyResult` | `daily_game_results` (queda como histórico) | Después de F1 y de fusionar todos los juegos |
| 4 | Apuestas y torneos de duelos | `duel_bets`, `duel-tournaments` | `duel_bets`, `duel_tournament_*` | Devolver las monedas de apuestas abiertas antes de cerrar |
| 5 | Liga de grupos y divisiones | `group-league`, `group_divisions` | `group_divisions`, `group_cup*` | La Copa semanal **no** se toca |
| 6 | Quiniela, Campeón y descenso, Mercado de pases | `/quiniela`, `/pronosticos`, `/mercado`, `quiniela`, `season-predictions`, `transfers` | `quiniela_predictions`, `season_predictions`, `transfer_*` | Esperar a que cierre la jornada o temporada en curso, o avisar con 14 días |
| 7 | Fantasy y FantasyFiction | `/fantasy*`, `/fantasyfiction`, `routes/fantasy*` | `fantasy_*`, `fx_*` | Esperar a que terminen las temporadas activas o avisar con 14 días. Antes, guardar la tabla final de cada liga en `archived_standings` (liga, usuario, puesto, puntos) y mostrarla en el perfil como «Fantasy 20XX: 3.º» |
| 8 | Trivia vieja, Modo B y banco de preguntas | `/trivia`, `Trivia.jsx`, `routes/questions`, `bonus`, `mode-b`, `group_question*`, `group_question_bank` | `questions`, `answers`, `bonus_*`, `special_*`, `personality_*`, `mode_b_*`, `group_question*` | Va después de congelar los logros (la mayoría sale de aquí). Borrar también `mode-b.test.js` |
| 9 | Vida FUT, Fútbol, Estadísticas, Historial y ranking global viejos | `/vida-fut`, `/futbol`, `/estadisticas`, `/historial`, `/ranking-global`, `stats.rankingBetween`, `GET groups/:id/ranking` | `game_history` (se queda) | El ranking nuevo es la tabla del club |
| 10 | Pantallas viejas de navegación | `Games`, `Dashboard`, `Group`, `Splash`, tutorial viejo, `CommandPalette`, `goltexto/` | — | Solo cuando `FUTOTAL2` deja de ser una bandera y pasa a ser el comportamiento por defecto |
| 11 | Html de `/legacy` | `draft-europeo.html`, `cotrero*.html` | — | 30 días después de las redirecciones del punto 1 y 2 |
| 12 | Código de logros viejo | `stats.js` (logros) | — | Después de 4.3 |

**En cada PR:**
- Actualizar `sitemap.xml`, las URL de los avisos push y la versión del caché de `sw.js`.
- Quitar los montajes de `server/index.js`.
- Correr `npm test`.
- Recorrer el sitio con Playwright para encontrar enlaces rotos.

### 4.3 Marcos de avatar y logros nuevos

**Problema.** Los marcos se ganan por cantidad de logros (`FRAME_REQUIREMENTS`: bronce 3, plata 6, oro 10, fuego 14, leyenda 17, revalidado en el servidor en `auth.js`). Unos 12 de los 17 logros dependen de lo que se borra. Si se borra sin más:
- Un usuario nuevo nunca podría pasar de plata.
- Los usuarios viejos perderían su marco cuando el servidor lo revalide.

**Decisión**

1. **Congelar (antes de la etapa A):**
   - Tabla `user_achievements` (`user_id`, `key`, `earned_at`, `legacy`).
   - Se llena una vez con los 17 logros actuales que cada usuario ya tiene, con `legacy = 1`.
   - Desde ese momento, los logros **solo se leen de esa tabla**: un logro ganado no se pierde nunca.
2. **Catálogo nuevo** (cada uno se escribe en `user_achievements` en el momento en que pasa, con `legacy = 0`):

| Logro | Cómo se gana |
|---|---|
| Primer partido | Jugar el primer Partido del día |
| Partido perfecto | 5 de 5 en el Partido del día |
| En llamas | Racha de 5 |
| Maratonista | Racha de 15 |
| Imparable | Racha de 30 |
| Semana completa | Las 7 cartas del día de una semana |
| Coleccionista | 50 cartas distintas |
| Plantilla armada | Completar un desafío de plantilla (SBC) |
| Campeón de copa | Ganar la Copa semanal |
| Podio del mes | Terminar 1.º, 2.º o 3.º del club en un mes |
| Campeón del mes | Terminar 1.º del club en un mes |
| Cazafantasmas | Ganarle 5 veces al fantasma |
| Cara a cara | Ganar 5 Versus |
| Adivino del clásico | 8 o más en la alineación del evento (`line_guesses`) |
| Pronosticador | Acertar 3 pronósticos de evento |
| Hincha fiel | Jugar 5 partidos temáticos |
| Amistoso ganado | Ganar un amistoso entre clubes |
| Leyenda | Etiqueta Leyenda en Cotrero (verificada) |
| ADN completo | Las 5 áreas del ADN con datos |
| Duelista | Se mantiene |
| Cazademonios | Se mantiene |
| Invicto | Se mantiene |

   Son 22 en el catálogo nuevo, más los legados.
   - «Cazafantasmas» necesita guardar las victorias contra el fantasma en el servidor. Si hoy no se guardan, se agrega un contador en el mismo PR.
   - El logro «Leyenda» (Cotrero) sale de la fuente verificada del punto 2.
3. **Marcos:**
   - Se mantienen los umbrales por cantidad (3/6/10/14/17), contando logros **legados y nuevos** juntos.
   - Se agregan 3 **marcos de trofeo** que no dependen de la cantidad:
     - **Copa**: haber ganado una Copa semanal.
     - **Racha**: haber llegado a 30.
     - **Podio**: haber salido campeón del mes.
   - El servidor sigue revalidando, ahora contra `user_achievements`.
4. **Vitrina** (`Vitrina.jsx`): muestra primero el catálogo nuevo. Los logros legados van en una sección «Clásicos de Futotal», con su fecha, sin forma de ganarlos de nuevo.

### 4.4 Pasos ordenados

1. Exportar la base.
2. `user_achievements` + congelar + leer los logros de ahí. Los marcos revalidan contra la tabla. Prueba: un usuario con marco oro sigue con oro.
3. Catálogo nuevo y marcos de trofeo.
4. Archivar Fantasy (`archived_standings`) y avisar con 14 días si hay temporadas activas.
5. Etapa A, todos los grupos en un solo despliegue (es reversible).
6. A los 30 días, etapa B, un PR por grupo en el orden de 4.2.
7. Etapa C solo si el dueño la pide.

### 4.5 Álbum de selecciones (W7)

**Hoy:** los partidos de Chile ya son el evento temático «La Roja». No hay álbum ni banner.

**Decisión**

- **Torneos de selecciones** (Copa América, Mundial, Eliminatorias en doble fecha): se crean **a mano en el panel del dueño** (`/admin`). Así no depende de detectar la competencia automáticamente.
  - Tabla `tournaments`: `id`, `nombre`, `inicio`, `fin`, `selecciones_json`, `grupos_json`.
- **Página del álbum** (`/album/:torneo`, con acceso desde Hoy y desde el Club mientras dura el torneo):
  - Una página por selección participante.
  - Casilleros con las cartas de jugadores de esa selección. La nacionalidad sale de los datos de las cartas.
  - **Progreso por selección** = cartas distintas que tienes de esa selección / `min(11, cartas que existen de esa selección)`.
  - No se incluyen las selecciones con menos de 5 cartas en el juego (con aviso «sin cartas suficientes»).
- **Premios**, una sola vez cada uno:

| Logro en el álbum | Premio |
|---|---|
| 1 selección completa | Sobre normal |
| 4 selecciones completas | Sobre bueno |
| Chile completa | Sobre top |
| Todas las selecciones completas | Insignia del torneo en el perfil |

- **Durante el torneo:** cada sobre trae 1 carta garantizada de una selección participante. No cambia la cantidad de cartas del sobre.
- **Un desafío de plantilla por grupo del torneo**, que dura lo que la fase de grupos. Ejemplo: «XI del grupo A», una carta por puesto de selecciones del grupo, a cambio de un sobre temático. Se usan las repetidas, como decidió el dueño.
- **Banner de temporada** en Hoy:
  - Nombre del torneo y fase («Fase de grupos · día 4 de 12»).
  - Próximo partido de Chile, con un enlace al evento La Roja si existe.
  - Usa los colores del evento La Roja que ya existen.
- **Al terminar:** el álbum queda en el perfil como «Álbum Copa América 20XX: 7 de 10 selecciones», de solo lectura, desde el mes siguiente.

**Pasos ordenados**
1. Tabla y formulario en `/admin`.
2. Cálculo del progreso y página del álbum.
3. Premios con pruebas: no se cobran dos veces.
4. Carta garantizada en los sobres.
5. Desafíos por grupo.
6. Banner.
7. Archivado.

**Criterios de terminado**
- Con un torneo de prueba creado desde el panel, el álbum muestra solo selecciones con 5 cartas o más.
- Completar una selección da el sobre una sola vez, aunque se reabra la página o se vendan cartas después.
- El banner aparece entre la fecha de inicio y la de fin, y desaparece solo.

**Riesgos**
- Pocas cartas de algunas selecciones vuelven el álbum imposible o trivial. Lo cubren el mínimo de 5 y el `min(11, …)`.
- La nacionalidad en los datos de cartas puede venir vacía o mal escrita. Hay que normalizarla antes; las cartas sin nacionalidad no cuentan.

### 4.6 Criterios de terminado de la limpieza

- Después de la etapa A:
  - Ningún enlace visible lleva a algo borrado (lo comprueba Playwright).
  - Los links viejos redirigen.
  - Los endpoints de escritura responden 410.
  - Los marcos y logros de todos los usuarios son los mismos que antes. Se verifica comparando una consulta antes y después: cantidad de logros por usuario ≥ la de antes.
- Después de cada PR de la etapa B: `npm test` en verde, compilación sin advertencias nuevas, tamaño del paquete del cliente igual o menor.
- El historial de Fantasy se ve en el perfil.

### 4.7 Riesgos

- **Perder lo ganado por los usuarios** (marcos, títulos, Fantasy): cubierto por el congelado previo y el archivo.
- **Borrar tablas es irreversible:** por eso la etapa C es opcional y requiere exportación y OK explícito.
- **Rutas que siguen apareciendo en avisos push viejos o en links de WhatsApp:** cubiertas con redirección a `/` en vez de un 404.
- **Hacer la etapa A antes de que el rediseño esté abierto a todos** dejaría a los usuarios sin `FUTOTAL2` sin nada que jugar. La condición de las 2 semanas no se salta.

---

## 5. Orden global recomendado

1. F1 (falla del `partido_dia`) — inmediato.
2. Infraestructura de la fusión + Bingo, ¿Qué club?, Más o menos, VAR y Trivia.
3. `MatchStage` (pasos 3.6.1–3.6.6) en paralelo con ¿Quién es? y Versus (incluye F2 para `versus`).
4. Cotrero renovado (incluye F2 para `carrera`).
5. Draft (necesita `MatchStage`; incluye F2 para `draft`). `dt_podio` en el cierre semanal de DT Online.
6. Congelar logros + catálogo nuevo + marcos de trofeo.
7. W7, que se puede adelantar si hay un torneo de selecciones cerca. No depende de lo anterior.
8. Limpieza: etapa A, 30 días, etapa B.
