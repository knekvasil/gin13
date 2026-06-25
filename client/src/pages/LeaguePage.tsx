import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useLeagueCurrent,
  useLeagueSeasons,
  useLeagueRounds,
  type LeagueCurrent,
} from "../stats/league-hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Button } from "../components/ui/button";

const RANK_COLORS = [
  "text-yellow-500",
  "text-gray-400",
  "text-amber-700",
  "text-muted-foreground",
];

function RankDisplay({ rank, small }: { rank: number; small?: boolean }) {
  return (
    <span className={`font-bold tabular-nums ${RANK_COLORS[rank - 1] ?? RANK_COLORS[3]} ${small ? "text-xs" : "text-sm"}`}>
      {rank}
      <span className="text-[0.55em] align-top">{rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th"}</span>
    </span>
  );
}

function StandingsTable({ data }: { data: NonNullable<LeagueCurrent["season"]> }) {
  const navigate = useNavigate();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Bot</TableHead>
          <TableHead className="text-right">MP</TableHead>
          <TableHead className="text-right">Pld</TableHead>
          <TableHead className="text-right">ELO</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.standings.map((s, i) => (
          <TableRow
            key={s.botId}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => navigate(`/bot-league/${s.botId}`)}
          >
            <TableCell><RankDisplay rank={i + 1} /></TableCell>
            <TableCell className="font-medium">{s.name}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{s.matchPoints}</TableCell>
            <TableCell className="text-right tabular-nums">{s.matchesPlayed}</TableCell>
            <TableCell className="text-right tabular-nums">{s.elo}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RoundDetails({ seasonId }: { seasonId: string }) {
  const { data, isLoading } = useLeagueRounds(seasonId);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  if (isLoading) return <p className="text-muted-foreground text-xs px-3 pb-3">Loading rounds...</p>;
  if (!data) return null;

  return (
    <div className="space-y-3 px-3 py-3">
      {data.rounds.map((r) => (
        <div key={r.roundNumber} className="rounded-md border">
          <button
            onClick={() => setExpandedRound(expandedRound === r.roundNumber ? null : r.roundNumber)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50"
          >
            <span>Round {r.roundNumber}</span>
            <span className="text-muted-foreground">
              {r.status === "COMPLETE" ? `${r.pods.length} pods` : "Pending"}
            </span>
          </button>
          {expandedRound === r.roundNumber && (
            <div className="border-t px-3 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {r.pods.map((pod, pi) => (
                  <div key={pi} className="rounded-sm bg-muted/30 p-2 text-xs">
                    <p className="text-muted-foreground mb-1 font-medium">Pod {pi + 1}</p>
                    {pod.results.map((res) => (
                      <div key={res.botId} className="flex items-center gap-2 py-0.5">
                        <RankDisplay rank={res.rank} small />
                        <span>{res.name}</span>
                        <span className="text-muted-foreground ml-auto">{res.score} pts</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function LeaguePage() {
  const { data: current } = useLeagueCurrent();
  const { data: pastSeasons } = useLeagueSeasons();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"standings" | "rounds" | "past">("standings");
  const [selectedPastSeason, setSelectedPastSeason] = useState<string | null>(null);

  const seasonData = current?.season;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      {seasonData && (
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-bold">Bot League</h1>
            <p className="text-muted-foreground text-xs">{seasonData.name}</p>
          </div>
          <p className="text-muted-foreground text-xs">
            Round {seasonData.currentRound} of {seasonData.roundCount}
          </p>
        </div>
      )}

      <div className="flex gap-1 rounded-md bg-muted p-0.5">
        {(["standings", "rounds", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "standings" ? "Standings" : t === "rounds" ? "Round Details" : "Past Seasons"}
          </button>
        ))}
      </div>

      <div className="rounded-lg border">
        {tab === "standings" && (
          seasonData ? <StandingsTable data={seasonData} /> : <p className="text-muted-foreground p-4 text-xs">No active season.</p>
        )}

        {tab === "rounds" && (
          seasonData ? <RoundDetails seasonId={seasonData.id} /> : <p className="text-muted-foreground p-4 text-xs">No active season.</p>
        )}

        {tab === "past" && (
          <div className="p-4">
            {(!pastSeasons || pastSeasons.seasons.length === 0) && (
              <p className="text-muted-foreground text-xs">No completed seasons yet.</p>
            )}
            <div className="space-y-2">
              {(pastSeasons?.seasons ?? []).map((s) => (
                <div
                  key={s.id}
                  className={`cursor-pointer rounded-md border p-3 text-xs transition-colors hover:bg-muted/50 ${
                    selectedPastSeason === s.id ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedPastSeason(selectedPastSeason === s.id ? null : s.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">{s.roundCount} rounds</span>
                  </div>
                  {s.topThree.length > 0 && (
                    <div className="text-muted-foreground mt-1 flex gap-3">
                      {s.topThree.map((t, i) => (
                        <span key={t.botId}>
                          <RankDisplay rank={i + 1} small /> {t.matchPoints}pts
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={() => navigate("/lobby")}>
        Back to Lobby
      </Button>
    </div>
  );
}
