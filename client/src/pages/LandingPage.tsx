import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/button";
import CardAnimation from "../components/CardAnimation";
import CardScatter from "../components/CardScatter";

export default function LandingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 text-center overflow-hidden">
      <CardScatter />

      <div className="space-y-10 max-w-md relative">
        <div className="space-y-4">
          <h1 className="text-5xl font-black tracking-tight">Gin 13</h1>
          <p className="text-muted-foreground text-lg">
            A multi-round card game for 3–4 players. Draw, meld, and manipulate
            your way to the lowest score across 13 rounds.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button size="lg" onClick={() => navigate(token ? "/lobby" : "/login")}>
            Play Now
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/how-to")}>
            How to Play
          </Button>
        </div>
        <CardAnimation />
      </div>
    </div>
  );
}
