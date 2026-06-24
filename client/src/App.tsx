import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ThemeProvider } from "./components/theme-provider";
import { TooltipProvider } from "./components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import HowToPage from "./pages/HowToPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LandingPage from "./pages/LandingPage";
import LobbyPage from "./pages/LobbyPage";
import GameRoomPage from "./pages/GameRoomPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import MatchHistoryPage from "./pages/MatchHistoryPage";
import MatchDetailPage from "./pages/MatchDetailPage";
import LeaguePage from "./pages/LeaguePage";
import BotDetailPage from "./pages/BotDetailPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/lobby" replace />;
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
          <TooltipProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<PublicRoute><NonGameLayout><LoginPage /></NonGameLayout></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><NonGameLayout><RegisterPage /></NonGameLayout></PublicRoute>} />
              <Route path="/" element={<LandingPage />} />
              <Route path="/lobby" element={<ProtectedRoute><NonGameLayout><LobbyPage /></NonGameLayout></ProtectedRoute>} />
              <Route path="/game/:roomId" element={<ProtectedRoute><GameRoomPage /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><NonGameLayout><LeaderboardPage /></NonGameLayout></ProtectedRoute>} />
              <Route path="/matches" element={<ProtectedRoute><NonGameLayout><MatchHistoryPage /></NonGameLayout></ProtectedRoute>} />
              <Route path="/match/:matchId" element={<ProtectedRoute><NonGameLayout><MatchDetailPage /></NonGameLayout></ProtectedRoute>} />
              <Route path="/how-to" element={<NonGameLayout><HowToPage /></NonGameLayout>} />
              <Route path="/bot-league" element={<ProtectedRoute><NonGameLayout><LeaguePage /></NonGameLayout></ProtectedRoute>} />
              <Route path="/bot-league/:botId" element={<ProtectedRoute><NonGameLayout><BotDetailPage /></NonGameLayout></ProtectedRoute>} />
            </Routes>
          </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
