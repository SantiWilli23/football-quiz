import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Splash from "./pages/Splash.jsx";
import InvitePreview from "./pages/InvitePreview.jsx";
import Dashboard from "./pages/Dashboard.jsx";

// Todo lo que no hace falta para el primer pantallazo (login/splash/panel) se
// separa en su propio chunk — el bundle venía creciendo con cada juego nuevo
// (ya pasaba los 750kb) y la enorme mayoría de una sesión nunca visita, por
// ejemplo, Carrera DT o Equipo-Jugador.
const Trivia = lazy(() => import("./pages/Trivia.jsx"));
const Group = lazy(() => import("./pages/Group.jsx"));
const History = lazy(() => import("./pages/History.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Stats = lazy(() => import("./pages/Stats.jsx"));
const Duels = lazy(() => import("./pages/Duels.jsx"));
const Football = lazy(() => import("./pages/Football.jsx"));
const Games = lazy(() => import("./pages/Games.jsx"));
const Survival = lazy(() => import("./pages/Survival.jsx"));
const Wordle = lazy(() => import("./pages/Wordle.jsx"));
const Quiniela = lazy(() => import("./pages/Quiniela.jsx"));
const UnMinuto = lazy(() => import("./pages/UnMinuto.jsx"));
const CrestQuiz = lazy(() => import("./pages/CrestQuiz.jsx"));
const SeasonPredictions = lazy(() => import("./pages/SeasonPredictions.jsx"));
const CareerMode = lazy(() => import("./carrera/index.jsx"));
const EquipoJugador = lazy(() => import("./equipo-jugador/index.jsx"));
const DtLeagueHome = lazy(() => import("./dt-liga/DtLeagueHome.jsx"));
const DtLeagueRoom = lazy(() => import("./dt-liga/DtLeagueRoom.jsx"));
const LiveMatch = lazy(() => import("./dt-liga/LiveMatch.jsx"));
const Copa8a2 = lazy(() => import("./pages/Copa8a2.jsx"));
const FantasyFiction = lazy(() => import("./pages/FantasyFiction.jsx"));
const Presidente = lazy(() => import("./pages/Presidente.jsx"));
const ArbitrajeVar = lazy(() => import("./pages/ArbitrajeVar.jsx"));
const GlobalRanking = lazy(() => import("./pages/GlobalRanking.jsx"));
const VidaFut = lazy(() => import("./pages/VidaFut.jsx"));

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

export default function App() {
  return (
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
      <Route
        path="/registro"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Splash />
          </PrivateRoute>
        }
      />
      <Route
        path="/panel"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/trivia"
        element={
          <PrivateRoute>
            <Trivia />
          </PrivateRoute>
        }
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
            <Games />
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
        path="/quiniela"
        element={
          <PrivateRoute>
            <Quiniela />
          </PrivateRoute>
        }
      />
      <Route
        path="/pronosticos"
        element={
          <PrivateRoute>
            <SeasonPredictions />
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
        path="/fantasyfiction"
        element={
          <PrivateRoute>
            <FantasyFiction />
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
        path="/vida-fut"
        element={
          <PrivateRoute>
            <VidaFut />
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
        path="/ranking-global"
        element={
          <PrivateRoute>
            <GlobalRanking />
          </PrivateRoute>
        }
      />
      <Route
        path="/carrera-dt"
        element={
          <PrivateRoute>
            <CareerMode />
          </PrivateRoute>
        }
      />
      <Route
        path="/equipo-jugador"
        element={
          <PrivateRoute>
            <EquipoJugador />
          </PrivateRoute>
        }
      />
      <Route
        path="/dt-liga"
        element={
          <PrivateRoute>
            <DtLeagueHome />
          </PrivateRoute>
        }
      />
      <Route
        path="/dt-liga/:code"
        element={
          <PrivateRoute>
            <DtLeagueRoom />
          </PrivateRoute>
        }
      />
      <Route
        path="/dt-liga/:code/live/:fixtureId"
        element={
          <PrivateRoute>
            <LiveMatch />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
