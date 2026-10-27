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

## Hecho (con tests: 150 en el servidor, y recorrido en navegador a 375 px)

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
7. **W7 · Temporada especial de torneo de selecciones**: no se hizo (depende de que haya un torneo).
8. **Marcos de avatar y logros nuevos, «Ver demo» de 10 s en el «?»**: no se hicieron.
9. **Decisión del dueño (V2)**: el plan gratis de Render se duerme tras ~15 minutos sin tráfico, lo que afecta el aviso de gol, los avisos «a tu hora» y los cierres automáticos. Alternativas: plan pagado, o un cron externo a `POST /api/jobs/run` con el encabezado `x-cron-secret`.
10. **Conflicto con una decisión anterior**: el plan dice que las partidas libres suman puntos en clubes Total; antes se había pedido que la diversión nunca diera puntos. Como el modo por defecto es Clásico, hoy no suman. Si se prefiere que nunca sumen, se quita la fuente `libre:*` del libro (`utils/ledger.js`).
