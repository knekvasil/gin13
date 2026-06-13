import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ThemeProvider } from "./components/theme-provider";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LobbyPage from "./pages/LobbyPage";
import GameRoomPage from "./pages/GameRoomPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import MatchHistoryPage from "./pages/MatchHistoryPage";
import MatchDetailPage from "./pages/MatchDetailPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NonGameLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<PublicRoute><NonGameLayout><LoginPage /></NonGameLayout></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><NonGameLayout><RegisterPage /></NonGameLayout></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><NonGameLayout><LobbyPage /></NonGameLayout></ProtectedRoute>} />
              <Route path="/game/:roomId" element={<ProtectedRoute><GameRoomPage /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><NonGameLayout><LeaderboardPage /></NonGameLayout></ProtectedRoute>} />
              <Route path="/matches" element={<ProtectedRoute><NonGameLayout><MatchHistoryPage /></NonGameLayout></ProtectedRoute>} />
              <Route path="/match/:matchId" element={<ProtectedRoute><NonGameLayout><MatchDetailPage /></NonGameLayout></ProtectedRoute>} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
