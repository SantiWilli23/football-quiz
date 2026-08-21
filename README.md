# Football Quiz

Plataforma de trivia de fútbol para grupos de amigos. Una pregunta nueva cada día, puntos, rachas y ranking grupal.

**En vivo:** https://football-quiz-nod2.onrender.com

## Stack

- **Backend**: Node.js + Express + `@libsql/client` (SQLite) + JWT + bcryptjs
- **Frontend**: React + Vite + Tailwind CSS
- **Estructura**: monorepo (`/server`, `/client`)

## Desarrollo local

Requiere Node.js 18+.

```bash
# Backend
cd server
npm install
cp .env.example .env      # editar JWT_SECRET si querés
npm run seed               # carga 10 preguntas de ejemplo
npm run dev                 # http://localhost:4000

# Frontend (en otra terminal)
cd client
npm install
npm run dev                 # http://localhost:5173 (proxy a la API en :4000)
```

## Producción (un solo servicio)

El servidor Express sirve también el build de React, así que en producción alcanza con un único servicio:

```bash
cd client && npm install && npm run build
cd ../server && npm install
npm start          # corre el seed (idempotente) y levanta el servidor en $PORT
```

## Desplegar como página web real (Render + Turso)

Este repo incluye `render.yaml` para desplegar con un click en [Render](https://render.com).

### 1. Base de datos persistente con Turso (gratis)

Render no ofrece disco persistente en el plan gratuito, así que para no perder los datos en cada redeploy usamos [Turso](https://turso.tech) (hecho por el mismo equipo de libSQL, compatible 1:1 con `@libsql/client`):

1. Creá una cuenta gratis en https://turso.tech (podés entrar con GitHub).
2. Instalá el CLI y logueate, o usá el dashboard web para crear una base:
   ```bash
   turso db create football-quiz
   turso db show football-quiz --url
   turso db tokens create football-quiz
   ```
3. Guardá el **URL** (`libsql://football-quiz-....turso.io`) y el **token**.

### 2. Subir el código a GitHub

```bash
git init
git add .
git commit -m "Football Quiz: app completa"
gh repo create football-quiz --public --source=. --push
```

(o creá el repo manualmente en github.com y hacé `git remote add origin <url> && git push -u origin main`)

### 3. Desplegar en Render

1. Entrá a https://dashboard.render.com → **New** → **Blueprint**.
2. Conectá el repo `football-quiz` de GitHub.
3. Render detecta `render.yaml` automáticamente. `JWT_SECRET` se genera solo.
4. Completá las variables `DATABASE_URL` y `DATABASE_AUTH_TOKEN` con los valores de Turso del paso 1.
5. Deploy. En unos minutos la app queda disponible en `https://football-quiz-XXXX.onrender.com`, accesible para cualquiera.

Cada vez que el servicio arranca, se ejecuta `node db/seed.js` automáticamente (usa `INSERT OR IGNORE`, así que nunca duplica preguntas) — esto además va extendiendo el calendario de preguntas hacia adelante en cada reinicio.

### Alternativa sin Turso

Si preferís no usar Turso, dejá `DATABASE_URL` sin definir: el servidor usa un archivo SQLite local (`server/data/football.db`). Funciona, pero en Render (plan free) el disco es efímero y **los datos se pierden en cada redeploy**. Sirve para probar rápido, no para producción real.

## Variables de entorno (`server/.env`)

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (Render lo define solo) |
| `JWT_SECRET` | Secreto para firmar los JWT |
| `DATABASE_URL` | `file:./data/football.db` en local, o `libsql://...` de Turso en producción |
| `DATABASE_AUTH_TOKEN` | Token de Turso (solo si usás Turso) |
