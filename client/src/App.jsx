import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Splash from "./pages/Splash.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Trivia from "./pages/Trivia.jsx";
import Group from "./pages/Group.jsx";
import History from "./pages/History.jsx";
import Profile from "./pages/Profile.jsx";
import Stats from "./pages/Stats.jsx";
import Duels from "./pages/Duels.jsx";
import Football from "./pages/Football.jsx";
import Survival from "./pages/Survival.jsx";
import CareerMode from "./carrera/index.jsx";
import EquipoJugador from "./equipo-jugador/index.jsx";
import DtLeagueHome from "./dt-liga/DtLeagueHome.jsx";
import DtLeagueRoom from "./dt-liga/DtLeagueRoom.jsx";
import LiveMatch from "./dt-liga/LiveMatch.jsx";

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
  return children;
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
