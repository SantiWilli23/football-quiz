import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Recover from "./pages/Recover.jsx";
import Splash from "./pages/Splash.jsx";
import InvitePreview from "./pages/InvitePreview.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import { FEATURES } from "./data/features.js";
import useFutotal2 from "./v2/useFutotal2.js";
import { WithSide } from "./v2/Shell.jsx";
import { LEGACY, redirectFor } from "./v2/fusion.js";

// Pantallas de funciones apagadas (client/src/data/features.js): si la bandera
// está en false, quien entre por un link viejo vuelve a Juegos.
function FeatureGate({ flag, children }) {
  return FEATURES[flag] ? children : <Navigate to="/juegos" replace />;
}

// Todo lo que no hace falta para el primer pantallazo (login/splash/panel) se
// separa en su propio chunk — el bundle venía creciendo con cada juego nuevo
// (ya pasaba los 750kb) y la enorme mayoría de una sesión nunca visita, por
// ejemplo, Carrera DT o Equipo-Jugador.
const Group = lazy(() => import("./pages/Group.jsx"));
// Futotal 2.0 (se enciende con FUTOTAL2=1 en el servidor; ver v2/useFutotal2.js).
const Hoy = lazy(() => import("./v2/Hoy.jsx"));
const Partido = lazy(() => import("./v2/Partido.jsx"));
const Archivo = lazy(() => import("./v2/Archivo.jsx"));
const ClubV2 = lazy(() => import("./v2/Club.jsx"));
const Jugar = lazy(() => import("./v2/Jugar.jsx"));
const PartidoVivo = lazy(() => import("./v2/PartidoVivo.jsx"));
const Alineacion = lazy(() => import("./v2/Alineacion.jsx"));
const Entrenar = lazy(() => import("./v2/Entrenar.jsx"));
const Practica = lazy(() => import("./v2/Practica.jsx"));
const Portada = lazy(() => import("./v2/Portada.jsx"));
const Bienvenida = lazy(() => import("./v2/Bienvenida.jsx"));
const Admin = lazy(() => import("./v2/Admin.jsx"));
const Versus = lazy(() => import("./v2/Versus.jsx"));
const History = lazy(() => import("./pages/History.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Stats = lazy(() => import("./pages/Stats.jsx"));
const Duels = lazy(() => import("./pages/Duels.jsx"));
const Football = lazy(() => import("./pages/Football.jsx"));
const Games = lazy(() => import("./pages/Games.jsx"));
const Album = lazy(() => import("./v2/Album.jsx"));
const JugarJuego = lazy(() => import("./v2/JugarJuego.jsx"));
const QuienEs = lazy(() => import("./pages/QuienEs.jsx"));
const Cartas = lazy(() => import("./pages/Cartas.jsx"));
const CopaSemanal = lazy(() => import("./pages/CopaSemanal.jsx"));
const QuienEsVivo = lazy(() => import("./pages/QuienEsVivo.jsx"));
const Survival = lazy(() => import("./pages/Survival.jsx"));
const Wordle = lazy(() => import("./pages/Wordle.jsx"));
const UnMinuto = lazy(() => import("./pages/UnMinuto.jsx"));
const CrestQuiz = lazy(() => import("./pages/CrestQuiz.jsx"));
const CareerMode = lazy(() => import("./carrera/index.jsx"));
const EquipoJugador = lazy(() => import("./equipo-jugador/index.jsx"));
const DtLeagueHome = lazy(() => import("./dt-liga/DtLeagueHome.jsx"));
const DtLeagueRoom = lazy(() => import("./dt-liga/DtLeagueRoom.jsx"));
const LiveMatch = lazy(() => import("./dt-liga/LiveMatch.jsx"));
const Copa8a2 = lazy(() => import("./pages/Copa8a2.jsx"));
const Presidente = lazy(() => import("./pages/Presidente.jsx"));
const ArbitrajeVar = lazy(() => import("./pages/ArbitrajeVar.jsx"));
const QuienSabeMas = lazy(() => import("./pages/QuienSabeMas.jsx"));
const VarVotacion = lazy(() => import("./pages/VarVotacion.jsx"));
const Bingo = lazy(() => import("./pages/Bingo.jsx"));
const AQuienMeCompro = lazy(() => import("./pages/AQuienMeCompro.jsx"));
const Piramide = lazy(() => import("./pages/Piramide.jsx"));
const Torta = lazy(() => import("./pages/Torta.jsx"));
const DorsalHistorico = lazy(() => import("./pages/DorsalHistorico.jsx"));
const Subasta = lazy(() => import("./pages/Subasta.jsx"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-gray-500 text-sm">
      Cargando...
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-gray-500 text-sm">
        Cargando...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

// Con el rediseño encendido, el inicio de siempre pasa a ser «Hoy».
// Con el rediseño encendido, el catálogo de juegos pasa a ser «Jugar».
function GamesOrJugar() {
  const { on, ready } = useFutotal2();
  if (!ready) return null;
  return on ? <Jugar /> : <Games />;
}

// Raíz: con el rediseño, quien no inició sesión ve la portada (se juega antes de registrarse)
// y quien sí, va directo a Hoy. Sin el rediseño todo sigue como siempre.
// En computador, con el rediseño, las pantallas a pantalla completa llevan la barra lateral.
function SideIfV2({ children }) {
  const { on } = useFutotal2();
  return on ? <WithSide>{children}</WithSide> : children;
}

function Root() {
  const { user, loading } = useAuth();
  const { on, ready } = useFutotal2();
  if (loading || !ready) return null;
  if (user) return on ? <Navigate to="/hoy" replace /> : <Suspense fallback={<RouteFallback />}><Splash /></Suspense>;
  return on ? <Suspense fallback={<RouteFallback />}><Portada /></Suspense> : <Navigate to="/login" replace />;
}

// Rutas viejas de juegos que ya se fusionaron: con el rediseño y el juego abierto se redirigen a
// `/jugar/<juego>/<variante>` conservando la query, para no romper links compartidos.
function LegacyGate({ children }) {
  const { pathname, search } = useLocation();
  const { ready, on, games } = useFutotal2();
  const key = pathname.replace(/\/+$/, "") || "/";
  if (!LEGACY[key]) return children;
  if (!ready) return null;
  const to = on ? redirectFor(pathname, search, games) : null;
  return to ? <Navigate to={to} replace /> : children;
}

// Con el rediseño, esta ruta vieja pasa a otra (por ejemplo, el centro de «Mentiroso y más» ahora es Versus).
function V2Redirect({ to, children }) {
  const { on, ready } = useFutotal2();
  if (!ready) return null;
  return on ? <Navigate to={to} replace /> : children;
}

function PanelOrHoy() {
  const { on, ready } = useFutotal2();
  if (!ready) return null;
  return on ? <Navigate to="/hoy" replace /> : <Dashboard />;
}

export default function App() {
  return (
    <>
    <CommandPalette />
    <LegacyGate>
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route path="/invitacion/:code" element={<InvitePreview />} />
      <Route path="/recuperar" element={<PublicRoute><Recover /></PublicRoute>} />
      {/* Sin PublicRoute: al crear la cuenta hay que mostrar el código de recuperación
          antes de entrar, y Register se ocupa de redirigir si ya había sesión. */}
      <Route path="/registro" element={<Register />} />
      <Route path="/" element={<Root />} />
      <Route path="/practica" element={<Suspense fallback={<RouteFallback />}><Practica /></Suspense>} />
      <Route path="/versus" element={<PrivateRoute><Versus /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
      <Route path="/bienvenida" element={<PrivateRoute><Bienvenida /></PrivateRoute>} />
      <Route
        path="/panel"
        element={
          <PrivateRoute>
            <PanelOrHoy />
          </PrivateRoute>
        }
      />
      <Route path="/jugar/:juego" element={<PrivateRoute><JugarJuego /></PrivateRoute>} />
      <Route path="/jugar/:juego/:variante" element={<PrivateRoute><JugarJuego /></PrivateRoute>} />
      <Route path="/album" element={<PrivateRoute><Album /></PrivateRoute>} />
      {/* Funciones retiradas en Futotal 2.0: los links viejos llevan al inicio. */}
      {["/mercado", "/pase", "/quiniela", "/pronosticos", "/fantasy", "/fantasy/:id", "/fantasyfiction", "/vida-fut", "/ranking-global"].map((p) => <Route key={p} path={p} element={<Navigate to="/" replace />} />)}
      <Route path="/hoy" element={<PrivateRoute><Hoy /></PrivateRoute>} />
      <Route path="/hoy/archivo" element={<PrivateRoute><Archivo /></PrivateRoute>} />
      <Route path="/partido" element={<PrivateRoute><Partido /></PrivateRoute>} />
      <Route path="/partido/:date" element={<PrivateRoute><Partido /></PrivateRoute>} />
      <Route path="/club" element={<PrivateRoute><ClubV2 /></PrivateRoute>} />
      <Route path="/entrenar/:area" element={<PrivateRoute><Entrenar /></PrivateRoute>} />
      <Route path="/evento/alineacion/:date" element={<PrivateRoute><Alineacion /></PrivateRoute>} />
      <Route path="/vivo/:league/:id" element={<PrivateRoute><PartidoVivo /></PrivateRoute>} />
      <Route
        path="/trivia"
        element={<Navigate to="/panel" replace />}
      />
      <Route
        path="/grupo"
        element={
          <PrivateRoute>
            <Group />
          </PrivateRoute>
        }
      />
      <Route
        path="/historial"
        element={
          <PrivateRoute>
            <History />
          </PrivateRoute>
        }
      />
      <Route
        path="/futbol"
        element={
          <PrivateRoute>
            <Football />
          </PrivateRoute>
        }
      />
      <Route
        path="/juegos"
        element={
          <PrivateRoute>
            <GamesOrJugar />
          </PrivateRoute>
        }
      />
      <Route
        path="/copa-semanal"
        element={
          <PrivateRoute>
            <CopaSemanal />
          </PrivateRoute>
        }
      />
      <Route
        path="/quien-es-vivo"
        element={
          <PrivateRoute>
            <QuienEsVivo />
          </PrivateRoute>
        }
      />
      <Route
        path="/cartas"
        element={
          <PrivateRoute>
            <Cartas />
          </PrivateRoute>
        }
      />
      <Route
        path="/quien-es"
        element={
          <PrivateRoute>
            <QuienEs />
          </PrivateRoute>
        }
      />
      <Route
        path="/duelos"
        element={
          <PrivateRoute>
            <Duels />
          </PrivateRoute>
        }
      />
      <Route
        path="/var-votacion"
        element={
          <PrivateRoute>
            <VarVotacion />
          </PrivateRoute>
        }
      />
      <Route
        path="/quien-sabe-mas"
        element={
          <PrivateRoute>
            <V2Redirect to="/versus"><QuienSabeMas /></V2Redirect>
          </PrivateRoute>
        }
      />
      <Route
        path="/estadisticas"
        element={
          <PrivateRoute>
            <Stats />
          </PrivateRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
      <Route
        path="/supervivencia"
        element={
          <PrivateRoute>
            <Survival />
          </PrivateRoute>
        }
      />
      <Route
        path="/fulbodle"
        element={
          <PrivateRoute>
            <Wordle />
          </PrivateRoute>
        }
      />
      <Route
        path="/un-minuto"
        element={
          <PrivateRoute>
            <UnMinuto />
          </PrivateRoute>
        }
      />
      <Route
        path="/escudos"
        element={
          <PrivateRoute>
            <CrestQuiz />
          </PrivateRoute>
        }
      />
      <Route
        path="/copa-8a2"
        element={
          <PrivateRoute>
            <Copa8a2 />
          </PrivateRoute>
        }
      />
      <Route
        path="/presidente"
        element={
          <PrivateRoute>
            <Presidente />
          </PrivateRoute>
        }
      />
      <Route
        path="/bingo"
        element={
          <PrivateRoute>
            <Bingo />
          </PrivateRoute>
        }
      />
      <Route path="/tateti" element={<Navigate to="/bingo" replace />} />
      <Route
        path="/a-quien-me-compro"
        element={
          <PrivateRoute>
            <AQuienMeCompro />
          </PrivateRoute>
        }
      />
      <Route
        path="/piramide"
        element={
          <PrivateRoute>
            <Piramide />
          </PrivateRoute>
        }
      />
      <Route
        path="/subasta"
        element={
          <PrivateRoute>
            <Subasta />
          </PrivateRoute>
        }
      />
      <Route
        path="/dorsal-historico"
        element={
          <PrivateRoute>
            <DorsalHistorico />
          </PrivateRoute>
        }
      />
      <Route
        path="/traspasos"
        element={<Navigate to="/jugar/quien-es" replace />}
      />
      <Route
        path="/torta"
        element={
          <PrivateRoute>
            <Torta />
          </PrivateRoute>
        }
      />
      <Route
        path="/arbitraje-var"
        element={
          <PrivateRoute>
            <ArbitrajeVar />
          </PrivateRoute>
        }
      />
      <Route
        path="/carrera-dt"
        element={
          <PrivateRoute>
            <SideIfV2><CareerMode /></SideIfV2>
          </PrivateRoute>
        }
      />
      <Route
        path="/equipo-jugador"
        element={
          <PrivateRoute>
            <SideIfV2><EquipoJugador /></SideIfV2>
          </PrivateRoute>
        }
      />
      <Route
        path="/dt-liga"
        element={
          <PrivateRoute>
            <SideIfV2><DtLeagueHome /></SideIfV2>
          </PrivateRoute>
        }
      />
      <Route
        path="/dt-liga/:code"
        element={
          <PrivateRoute>
            <SideIfV2><DtLeagueRoom /></SideIfV2>
          </PrivateRoute>
        }
      />
      <Route
        path="/dt-liga/:code/live/:fixtureId"
        element={
          <PrivateRoute>
            <SideIfV2><LiveMatch /></SideIfV2>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </LegacyGate>
    </>
  );
}
