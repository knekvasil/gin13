import { useParams, useNavigate } from "react-router-dom";
import { useMatchDetail } from "../stats/hooks";
import { Button } from "../components/ui/button";
import MatchOverScreen from "../components/MatchOverScreen";

export default function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { data: matchDetail, isLoading, error } = useMatchDetail(matchId);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Match Details
        </h1>
        <Button variant="outline" onClick={() => navigate("/matches")}>
          Back to History
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {error && <p className="text-destructive text-sm">Error loading match details</p>}
      {matchDetail && <MatchOverScreen matchDetail={matchDetail} />}
    </div>
  );
}
