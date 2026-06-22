interface PlayerChipProps {
  player: { name: string; score: number; disconnected: boolean };
  isTurn?: boolean;
  timerPct?: number;
  rank?: number | null;
}

export default function PlayerChip({
  player, isTurn, timerPct, rank,
}: PlayerChipProps) {
  const isActive = !player.disconnected;
  const rankColor = rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-amber-700" : "";
  return (
    <div className={`relative flex flex-col rounded-lg px-2.5 py-1 text-xs transition-colors ${
      isTurn
        ? "ring-2 ring-primary bg-primary/5"
        : "bg-muted/50"
    }`}>
      {isTurn && timerPct != null && (
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none z-0">
          <div
            className="h-full transition-[width] duration-100 linear rounded-lg"
            style={{
              width: `${timerPct}%`,
              background: timerPct > 30
                ? "oklch(from var(--primary) l c h / 0.3)"
                : timerPct > 10
                  ? "rgb(255 152 0 / 0.3)"
                  : "rgb(244 67 54 / 0.4)",
            }}
          />
          {timerPct <= 10 && (
            <div className="absolute inset-0 animate-pulse rounded-lg" style={{ background: "rgb(244 67 54 / 0.15)" }} />
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5 relative z-20">
        <div className="relative flex-shrink-0">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {player.name.charAt(0).toUpperCase()}
          </span>
          {isActive && (
            <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background ${
              isTurn ? "bg-green-500 animate-pulse" : "bg-green-500"
            }`} />
          )}
          {!isActive && (
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-red-500" />
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{player.name}</span>
            {player.disconnected && <span className="text-destructive text-[10px]">(DC)</span>}
          </div>
          <div className="flex items-center gap-1">
            {rank != null && rank <= 3 && (
              <span className={`font-bold ${rankColor}`}>
                {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
              </span>
            )}
            {rank != null && rank >= 4 && (
              <span className="text-muted-foreground">{rank}th</span>
            )}
            {rank != null && <span className="text-muted-foreground">&mdash;</span>}
            <span className="text-muted-foreground">{player.score}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
