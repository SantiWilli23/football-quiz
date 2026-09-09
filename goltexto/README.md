# Goltexto

Clon de Contexto/Goltexto, pero de fútbol. Escribís nombres de futbolistas y cada intento te devuelve un puntaje de similitud (0-100) contra el jugador secreto, basado en equipo, liga, nacionalidad, posición y edad. Diseño 100% en blanco/negro/grises — sin colores de acento en ningún lado.

## Correr localmente

```bash
npm install
npm run dev
```

Abre en `http://localhost:5173`.

## Otros comandos

```bash
npm run build      # build de producción (type-check + vite build)
npm run preview    # sirve el build de producción localmente
npm run test       # corre los tests del algoritmo de scoring (vitest)
npm run build:data # regenera src/data/players.json desde la base de Equipo-Jugador
```

## Estructura

```
src/
  components/   UI (StartScreen, GuessInput, GuessList, GuessRow, EndScreen)
  data/         players.json — dataset de jugadores
  types/        interfaces TypeScript (Player, Guess, MaxAttempts)
  utils/
    scoring.ts       función pura de similitud (scoreGuess) + tests
    scoring.test.ts
    gameUtils.ts      modo diario (semilla por fecha), localStorage, texto para compartir
```

## Sobre los datos

`src/data/players.json` se generó con `scripts/build-players.cjs` a partir de la
misma base que usa el juego "Equipo-Jugador" (`server/data/equipo-jugador-players.json`
en el repo padre). Ese dataset trae la carrera completa de cada jugador (todos los
clubes con años), pero no trae directamente club actual/liga/edad — así que el
script:

1. determina el club "actual" de cada jugador (el tramo sin año de fin, o si no
   hay ninguno abierto, el más reciente),
2. lo mapea a una liga conocida con una tabla curada (top-5 europeas + varias
   ligas más donde el dataset tiene fuerza: Chile, Brasil, Argentina, MLS, Liga MX,
   Arabia Saudita, Turquía, Países Bajos, Portugal, Qatar, Japón),
3. descarta a los jugadores cuyo club actual no cayó en esa tabla (para no meter
   un genérico "otra liga" que empobrece el juego),
4. calcula la edad como 2025 menos el año de nacimiento.

Quedaron **629 jugadores reales** con equipo, liga, nacionalidad, posición y edad.
Si se quiere reducir o ampliar la lista, alcanza con tocar `LEAGUE_MAP` en
`scripts/build-players.cjs` y volver a correr `npm run build:data`.

## Algoritmo de scoring

`src/utils/scoring.ts` exporta `scoreGuess(secret, guess): number`, una función
pura (sin UI, sin estado) que compara dos jugadores y devuelve 0-100:

- **100** — el jugador secreto exacto (mismo `id`).
- **80-98** — compañeros de equipo actual, o compatriotas con la posición exacta.
- **40-65** — comparten dos o más atributos relevantes (liga, nacionalidad,
  categoría de posición).
- **15-30** — comparten un solo atributo menor.
- **0-15** — no comparten nada relevante.

Dentro de cada tramo, la posición exacta, la cantidad de atributos extra
compartidos y la cercanía de edad empujan el número hacia arriba del tramo —
así el salto a 100 se siente abrupto sólo cuando de verdad estás cerca, y el
resto de la escala queda comprimido abajo. Ver `scoring.test.ts` para los casos
cubiertos.
