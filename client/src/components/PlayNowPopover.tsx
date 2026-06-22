import { useState } from "react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

interface PlayNowPopoverProps {
  onQuickPlay: () => void;
  onPractice: (bots: number) => void;
}

export default function PlayNowPopover({ onQuickPlay, onPractice }: PlayNowPopoverProps) {
  const [open, setOpen] = useState(false);
  const [rounds, setRounds] = useState(13);
  const [mode, setMode] = useState<"players" | "bots2" | "bots3">("players");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="lg">Play Now</Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-64 p-3">
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground mb-1.5 text-[0.6rem] font-medium uppercase tracking-wider">Rounds</p>
            <div className="grid grid-cols-4 gap-1">
              {[1, 3, 5, 13].map((r) => (
                <button
                  key={r}
                  onClick={() => setRounds(r)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    rounds === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-1.5 text-[0.6rem] font-medium uppercase tracking-wider">Opponents</p>
            <div className="grid grid-cols-3 gap-1">
              {[
                { value: "players" as const, label: "Players" },
                { value: "bots2" as const, label: "2 Bots" },
                { value: "bots3" as const, label: "3 Bots" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    mode === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            size="sm"
            onClick={() => {
              setOpen(false);
              if (mode === "players") {
                onQuickPlay();
              } else {
                onPractice(mode === "bots2" ? 2 : 3);
              }
            }}
          >
            Start Game
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
