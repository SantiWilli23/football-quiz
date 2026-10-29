# Futotal 2.0: estado de la implementación

Rama de trabajo: `claude/futotal-major-redesign-bl4ibi` (no se fusionó a `main` ni se desplegó).
Referencias: `LEEME-IMPLEMENTACION.md` (plan) y `prototipo-futotal-2.html` (diseño).

## Cómo probarlo

Todo el rediseño del cliente se enciende desde el servidor, así que el mismo build sirve para
probar el rediseño o seguir con la app de siempre.

| Variable | Qué hace |
| --- | --- |
| `FUTOTAL2=1` | Enciende el rediseño (navegación de 5 secciones, portada, sobres guardados, tareas programadas…). Sin ella, la app se comporta como siempre. |
| `OWNER_USERNAME=<usuario>` | Usuario que puede abrir `/admin` (panel del dueño). Sin ella el panel queda apagado. |
| `PUSH_CRON_SECRET` | Ya existía. También protege `POST /api/jobs/run` (cron externo que despierta el servicio y corre las tareas). |

Para probar en local: `cd server && FUTOTAL2=1 OWNER_USERNAME=tuUsuario npm start` y `cd client && npm run build`.
Antes de abrirlo a todos: copia de la base (Turso) y activar primero solo para el club del dueño.
Las migraciones son aditivas (columnas y tablas nuevas): volver a la versión vieja no rompe nada.

## Hecho (con tests: 151 en el servidor, y recorrido en navegador a 375 px)

- **Fase 0 · base**: el día de la app cambia a las 00:00 de Chile (`America/Santiago`); medición (`analytics_events`); tareas programadas (`utils/jobs.js`) y registro de errores/alertas.
- **Fase 1 · puntos y clubes**: libro único de puntos por club (`points_ledger`), modos Clásico y Total, pretemporada e inicio de temporada, entrada tardía, club principal, racha personal con protector, sobres guardados (máx. 3, solo con `FUTOTAL2=1`), código de recuperación de cuenta.
- **Fase 2 · navegación y partido del día**: Hoy · Jugar · Club · Cartas · Yo; partido de 3 partes con el puntaje calculado en el servidor (80% acierto, 20% rapidez, tiempo contrastado con el servidor); fantasma del rival; cómo respondió el club; archivo de partidos pasados; copa semanal automática con llaves; racha del club; jugar sin señal.
- **Fase 4 · cartas**: Cartas para todos, desafío temático con repetidas (cada 14 días rota la temática), sobre temático en la tienda, carta del día y álbum calendario, intercambio entre amigos.
- **Fase 4b · partidos en vivo**: modelo único de partido (probado con un partido real guardado en `server/test/fixtures/live/`), alineaciones ubicadas por formación, línea de tiempo, estadísticas, comentarios; un solo consultor por partido; visor para teléfono.
- **Fase 5 · eventos temáticos**: kits (`server/data/events/kits.json`), detección con ESPN (máx. 2 por semana), previa con pronóstico, «¿con quién vas?», duelo de hinchadas, adivinar la alineación, figura del partido, «el día después», insignia y sobre del evento.
- **Fase 6 · ADN y perfil**: seis áreas, análisis semanal y mensual, carta Futotal, entrenamiento de 2 minutos.
- **Fase 7 · primer ingreso**: portada con partido de práctica sin registro, registro con código de recuperación, club favorito, sobre de bienvenida, invitación con desafío, guías con mano animada y «agregar a inicio».
- **Extras posteriores**: Versus con ruleta que elige el modo (`/versus`), aviso push de gol en partidos temáticos (cuenta dentro del tope de 3 avisos por día) y calibración liviana del partido (una pregunta con 95% o más de aciertos, o 10% o menos, sale de la tanda cuando ya tiene 20 respuestas).
- **Fase 8 · vida de club**: cierre de mes con ceremonia y Sobre Élite, resumen de la semana, amistoso entre clubes, leyendas del club, tabla en vivo, avisos «a tu hora» con motivo (máx. 3 por día), panel del dueño.

## Pendiente o distinto de lo planeado (y por qué)

1. **Fase 3 · fusión de juegos**: no se fusionaron (salvo Versus, que ahora tiene su ruleta). «Jugar» agrupa los juegos en Arcade, Con amigos y Carrera y enlaza cada variante, pero siguen siendo las pantallas de siempre (no hay un «¿Quién es?» único, ni Versus con ruleta, ni Draft con el flujo de 7a0, ni Cotrero rehecho). Tampoco se borró ningún juego ni código viejo (A7): es irreversible para usuarios reales y conviene hacerlo recién cuando el rediseño esté abierto a todos.
2. **Visor único de partidos simulados (Fase 4b D)**: el visor nuevo es para partidos reales. `LivePitch`, `MatchPitch` y `MatchSimulator` siguen existiendo y no se migraron DT Online, Cartas, Subasta, Carrera ni 8a2.
3. **Aviso de gol**: solo para partidos temáticos y para quien pronosticó o eligió hinchada; depende de que las tareas corran (ver punto 9).
4. **Calibración de dificultad**: es liviana (solo saca las preguntas extremas de la tanda de penales); no ajusta el partido a un promedio objetivo.
5. **Leyendas del club**: Cotrero es una página estática que calcula su puntaje en el teléfono, así que el servidor lo acota (tope de 3000, etiquetas cerradas) pero no lo puede verificar. Es un salón entre amigos, no un ranking que da puntos. No se calcula «a qué figura se parece».
6. **Datos del juego especial** de los partidos temáticos: las preguntas «Messi o Cristiano» están revisadas a mano, pero las de «¿en qué club jugó?» salen de las carreras de la base de jugadores, que hay que revisar antes de publicar.
7. **W7 · torneo de selecciones**: versión mínima. Cualquier partido de Chile en Mundial, Copa América, eliminatorias o amistosos se vuelve un evento «La Roja» (colores, previa, pronóstico, hinchadas, insignia y sobre de La Roja). No hay álbum de selecciones ni banner de toda la temporada.
8. **Marcos de avatar y logros nuevos**: no se hicieron. El «?» ahora tiene «Ver demo» de 10 s.
9. **Decisión del dueño (V2)**: el plan gratis de Render se duerme tras ~15 minutos sin tráfico, lo que afecta el aviso de gol, los avisos «a tu hora» y los cierres automáticos. Alternativas: plan pagado, o un cron externo a `POST /api/jobs/run` con el encabezado `x-cron-secret`.
10. **Conflicto con una decisión anterior**: el plan dice que las partidas libres suman puntos en clubes Total; antes se había pedido que la diversión nunca diera puntos. Como el modo por defecto es Clásico, hoy no suman. Si se prefiere que nunca sumen, se quita la fuente `libre:*` del libro (`utils/ledger.js`).

## Segunda tanda (sobre `ESPEC-PENDIENTES.md`)

Todo sigue detrás de `FUTOTAL2=1`. Con `FUTOTAL2_JUEGOS=juego1,juego2` (por ejemplo `bingo,cotrero`) se abren los juegos fusionados de a uno; sin la variable se abren todos.

- **Fallas de main arregladas**: el diario rotativo viejo ocupaba `partido_dia`; `versus`, `draft`, `carrera` y `dt_podio` no se acreditaban nunca; `/api/clubs/me/streak` devolvía 500.
- **Club**: pestañas Tabla / Copa / Muro, ficha de miembro con cara a cara, insignias (escudo con aro que se enciende) y anillo de uniforme, crear club en 3 pasos.
- **Cartas, sonido y animaciones**: oferta del día, aviso al vender repetidas útiles, contador del desafío, silbato / gol / ambiente de estadio en eventos, ~15 animaciones nuevas del prototipo (con `prefers-reduced-motion`).
- **Panel del dueño**: crear desafíos de plantilla (filtro, fechas, monedas) y torneos de selecciones.
- **Fusión de juegos**: `/jugar/<juego>/<variante>` con chips y Récords, redirección de rutas viejas conservando la query, un cupo de puntos libres por juego fusionado y mensajes de por qué suma o no.
- **Visor único**: `MatchStage` + `SimMatch` en Cartas, Copa semanal, Subasta, DT Online y Draft (borrados `MatchPitch` y `LivePitch`).
- **Cotrero**: motor en el servidor (`utils/career-engine.js`), carreras verificadas, `careers/start|active|:id/act`.
- **Draft 8a2 solo**: 139 planteles extraídos (`server/data/draft-squads.json`), motor y simulación en el servidor, Champions animada.
- **Logros**: `user_achievements` con congelado de los anteriores, 22 logros nuevos con sus disparadores y marcos Copa / Racha 30 / Podio.
- **Álbum de selecciones (W7)**: torneos desde el panel, banner en Hoy, premios y carta de selección en cada sobre.
- **Versus y DT**: ganar un duelo suma 30; el podio de cada jornada de DT Online suma 60 / 40 / 20 en clubes Total.

### Tercera tanda (cierre de lo pendiente)

Visor único en la Carrera DT · puntos `versus` por victorias online verificadas por el relay · Draft contra un amigo en línea · Escudos «Medio» y aviso de partida a medias · limpieza etapa A (410 en escrituras retiradas) y etapa B de lo aislado (Pase, Quiniela, Campeón y descenso, Mercado, Fantasy, liga de grupos, Vida FUT, ranking global viejo, Trivia). Queda a propósito el camino sin rediseño y la etapa C (ver «Estado de ejecución» de `ESPEC-PENDIENTES.md`).

### Cuarta tanda (la capa visual del prototipo)

El dueño desplegó y vio «el mismo diseño». Era cierto: lo anterior cambió la mecánica pero la app seguía con la carcasa, la paleta y las tarjetas de antes, y «Jugar» se caía en blanco (el merge con main dejó un `Jugar.jsx` que leía `juegos` de `useFutotal2`, que devuelve `games`). En esta tanda:

- **Encendido por defecto**: `redesignOn()` es verdadero salvo `FUTOTAL2=0`. Las pruebas viejas fijan `FUTOTAL2=0` en `test/helpers.js`.
- **Sistema visual** (`client/src/v2/v2.css`, `<html data-v2>`): paleta del prototipo (césped `#08100d`, paneles verdes), tipografías Bricolage Grotesque / Figtree / Barlow Condensed, radios de 14–24 px, sin esquinas cortadas. Las variables `--c-*` son las de Tailwind, así que TODAS las pantallas (también los juegos de siempre) toman el aspecto nuevo. Se recuerda la última respuesta del servidor (`fq_v2`) para no parpadear.
- **Carcasa** (`v2/Shell.jsx`): marca FUTOTAL, racha y campana arriba; una sola columna (480 px, centrada en computador); Hoy · Jugar · Club · Cartas · Yo abajo.
- **Pantallas rehechas igual que el prototipo**: Portada (pelota que rebota), Hoy (marcador 1T/2T/PEN, cuenta regresiva a medianoche de Chile, semana Lun–Dom, racha y protector, racha del club «jugaron X de N», tabla con pendientes, copa, SBC, seguir jugando), Jugar (Para ti, partidas libres X/100, filas Arcade / Con amigos / Carrera con los 13 juegos), Club (escudo con sellos TOTAL ×2 / CLÁSICO / PRINCIPAL, pestañas, tabla con «Pendiente» y «Avisar»), Cartas (pestañas Sobres / Álbum / Mi once / SBC / Tienda, «Cómo ganas sobres»), Yo (carta Futotal que se da vuelta, ADN, números, vitrina, últimos partidos, ajustes).
- **Servidor**: `/clubs/me/streak` trae la semana; `/clubs/:id/streak` trae `playedToday`; `/clubs/:id/table` trae `playedToday`; `/clubs/me/free` (partidas libres de hoy); `/me/card` trae partidos, mejor marcador y últimos 7.
- **Idioma**: los textos pasan de voseo («Elegí», «Ganás», «vos») a tú, como el prototipo (unos 630 cambios en cliente y servidor).

Verificado con capturas a 390 px y 1280 px de cada pantalla, un partido del día jugado completo y `FUTOTAL2=0` (vuelve la app anterior).

### Quinta tanda (modo computador)

El modo teléfono queda como estaba. El modo computador usa el «Modo de pantalla» que ya existía (`data-device`, en Yo › Ajustes: Automático / Teléfono / Computador; Automático = computador desde 768 px):

- **Carcasa**: barra lateral fija (marca, racha, avisos, Hoy · Jugar · Club · Cartas · Yo y tu perfil abajo) en vez de las pestañas de abajo. Entre 768 y 1099 px la barra queda solo con íconos.
- **Ancho**: Hoy, Jugar, Club, Cartas y Yo usan hasta 1180 px (`<Layout hub>`); los juegos, 960 px para que no se estiren; Modo DT y otras pantallas anchas, 1440 px.
- **Dos columnas** (`.p-dgrid`): Hoy (partido y tabla | racha del club, copa, semana, seguir jugando), Club (tabla | invitar, modo, liga), Yo (carta, números, vitrina | ADN, últimos partidos, ajustes), Cartas › Sobres (para abrir | cómo ganas). En teléfono es una sola columna y `order` mantiene el orden del prototipo.
- **Jugar**: cuadrícula con descripción de cada juego (Arcade 3×2, Con amigos 3, Carrera 4) y «Para ti» en 3 tarjetas grandes.
- Encabezado de página solo en computador (`.p-dhead`), números del marcador más grandes, portada más grande.
- Arreglado el interruptor del fantasma (la bolita se salía).

### Sexta tanda (todo a computador, colores, Cotrero y Traspasos)

- **Todo adaptado a computador**: recorrido de todas las rutas a 1440 px. Modo DT, DT Online y Equipo-Jugador llevan la barra lateral (`WithSide`); Versus en dos columnas (ruleta | modos); Partidos pasados en cuadrícula; Iniciar sesión y Crear cuenta con panel de marca (`v2/BrandPanel.jsx`) en vez del panel viejo («Trivia diaria», «Grupos»); en modo enfoque «Salir» se alinea con el juego.
- **Bingo en negro arreglado** (afectaba también al teléfono): `/jugar/bingo` se redirigía a sí mismo porque tiene una sola variante.
- **Colores de vuelta**: Nocturno, Azul clásico y Cancha de día (clara) en versión rediseño; los colores fijos de `v2.css` pasaron a variables por tema. Selector «Colores» en Yo › Ajustes.
- **Cotrero único**: una tarjeta en Jugar; al entrar se elige la dificultad (Simple o Media) y dentro del juego se cambia con «Dificultad: Simple · Media».
- **Traspasos eliminado**: sale de ¿Quién es? (`/traspasos` redirige a ¿Quién es?) y de la rotación del juego diario desde el 30/10/2026 (las fechas anteriores conservan su juego).

### Séptima tanda (Modo DT y DT Online: jugabilidad, fichajes, calendario y diseño)

Plan hecho primero (diagnóstico jugando a 1440 px) y prototipo de referencia en Lovable (Inicio, Fichajes y Calendario). Canva no se pudo usar: la generación de diseños está deshabilitada en el equipo de Canva del dueño. Higgsfield en este conector solo lee (no genera).

- **Agenda unificada** (`carrera/engine/schedule.js`): liga los sábados, Europa los martes, copa nacional los miércoles (FA Cup, Copa del Rey, Coppa Italia o DFB-Pokal según la liga) y amistosos de pretemporada, todos con fecha. El próximo partido es siempre el primero sin jugar y la liga de una semana no se juega mientras quede pendiente el partido de entre semana. Antes la Copa y Europa eran tarjetas sueltas que se podían dejar colgadas.
- **Inicio del DT rehecho**: próximo partido de cualquier competición con un solo botón (y "Saltar la pretemporada"), bandeja (mercado y cierre, decisión de la semana, ofertas recibidas con Aceptar / Pedir más / Rechazar, ofertas de banquillo, contratos, lesionados), agenda de los próximos 6 partidos, mini tabla y objetivo.
- **Navegación**: 10 botones → 6 pestañas (Inicio · Plantel [plantel, formación, tácticas] · Fichajes · Calendario · Club [finanzas, cantera, historial] · Ajustes) con cabecera de fecha, posición, presupuesto y masa salarial. Sin segundo menú lateral en computador.
- **Fichajes 2.0** (sirve a los dos modos): necesidades del plantel por línea (ARQ/DEF/MED/DEL con semáforo), sugeridos que alcanzan, mercado como tabla ordenable (celular: filas) con filtros «Me alcanza», «Último año», «Solo scouteados», y negociación por rondas en un panel con burbujas: el club acepta si llegas, contraoferta si estás cerca (cede 3 % y 5 % en las rondas 2 y 3), rechaza o se enoja si estás muy lejos; sin azar cuando cumples. El jugador siempre contesta con su sueldo (no se ofende). Pago en 2 cuotas (+5 %, la segunda al empezar la temporada siguiente), pre-acuerdos con el mercado cerrado (se suman al abrir), tope de masa salarial (sueldos iniciales + 20 %) y «Pedir más» por ofertas recibidas.
- **Calendario**: mes con chips por competición, resultado en el día y la franja del mercado abierto; semana con los partidos de entre semana; lista de todos los partidos de todas las competiciones.
- **DT Online**: cabecera con el avance del mes y el mercado, pestañas nuevas, «tu próximo partido» con su botón arriba de la Jornada, chips por competición, y **fichajes entre managers** (`dt_league_player_offers`): ver las plantillas de los demás, ofertar, aceptar / rechazar / contraofertar; el trato se aplica en los dos clubes una sola vez (jugador y plata). El intercambio de clubes sigue, plegado al final del Mercado.
- Pruebas nuevas: `dt-motor.test.js` (agenda, ventanas, negociación, cuotas, necesidades, pedir más, contrato) y `dt-mercado-managers.test.js` (oferta, contraoferta, trato cerrado, mercado cerrado, sin plata).

## Versión Demo del dueño (OWNER_USERNAME)

Solo el usuario de `OWNER_USERNAME` ve el botón flotante «Futotal 1 · Actual · Demo» (ruta `GET /api/me/owner`; la elección vive en el navegador, `fq_version`). Los demás siempre ven «Actual».
- **Futotal 1**: la app de antes, sin el rediseño (solo para el dueño).
- **Demo**: cambios probados antes de pasarlos a Actual. Cada uno está registrado con su número en `client/src/demo/changes/index.js`; el panel los lista, cuenta («N cambios») y los copia uno a uno, elegidos o todos. Dos rediseños grandes seleccionables en «Diseño»: A «Noche de estadio» y B «Álbum de figuritas».
- Los cambios de la Demo se activan con `useDemo()` (`client/src/demo/version.js`); pasar uno a Actual es quitar su condición.
- Cambios actuales: 2A/2B (temas), 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16a–c (cartas).

### Cambios de la beta pasados a Actual (2026-10-29)
Aprobados por el dueño y ahora activos para todos (`useDemo()` es verdadero salvo en Futotal 1): 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16a, 16b y 16c.
Siguen solo en la beta (`data-beta`): 2A, 2B y 5 (colores y temas). Comentario del dueño: no gustó; funcionaba solo de noche y se perdió el verde característico. El próximo intento debe funcionar en claro y oscuro y conservar el verde.
