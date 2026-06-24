import { prisma } from "./db";
import { seedBots } from "./seed-bots";
import {
  GameState,
  Player,
  createGameState,
  CardSchema,
} from "./rooms/GameState";
import {
  startGame,
  botPlayTurn,
  startNextRound,
  calculateRoundScores,
} from "./rooms/game-engine";
import { persistRoundResults, persistMatchEnd } from "./rooms/match-repository";
import { ArraySchema } from "@colyseus/schema";

const BOT_COUNT = 24;
const POD_SIZE = 4;
const SEASON_ROUNDS = 7;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function swissPairings(
  standings: { botId: string; matchPoints: number; tiebreakElo: number }[],
  podSize: number,
): string[][] {
  const sorted = [...standings].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    return b.tiebreakElo - a.tiebreakElo;
  });

  const pods: string[][] = [];
  for (let i = 0; i < sorted.length; i += podSize) {
    const pod = sorted.slice(i, i + podSize).map((s) => s.botId);
    pods.push(shuffle(pod));
  }
  return pods;
}

async function runMatch(
  matchId: string,
  botIds: string[],
): Promise<void> {
  await prisma.match.create({
    data: { id: matchId, totalRounds: 13, status: "ACTIVE" },
  });

  for (const botId of botIds) {
    await prisma.matchPlayer.upsert({
      where: { matchId_userId: { matchId, userId: botId } },
      update: {},
      create: { matchId, userId: botId, score: 0 },
    });
  }

  const state = createGameState(13);
  for (const botId of botIds) {
    const bot = new Player();
    bot.sessionId = botId;
    bot.userId = botId;
    bot.name = botId;
    bot.hand = new ArraySchema<CardSchema>();
    bot.board = new ArraySchema<CardSchema>();
    bot.score = 0;
    bot.disconnected = false;
    bot.isBot = true;
    state.players.push(bot);
  }

  startGame(state);

  let turnCount = 0;
  while (state.status === "playing" && turnCount < 5000) {
    turnCount++;
    if (state.phase === "draw") {
      botPlayTurn(state);
    }
    if (state.phase === "round_ended") {
      const scores = calculateRoundScores(state);
      await persistRoundResults(
        prisma as any,
        matchId,
        state.currentRound,
        state.wildRank,
        scores,
        Array.from(state.players).filter(Boolean) as Player[],
      );
      if ((state.status as string) !== "finished") {
        startNextRound(state);
      }
    }
  }

  await persistMatchEnd(
    prisma as any,
    matchId,
    Array.from(state.players).filter(Boolean) as Player[],
  );
}

async function botLeague(): Promise<void> {
  await seedBots();

  const botIds: string[] = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    botIds.push(`bot_${i}`);
  }

  let season = await prisma.botSeason.findFirst({
    where: { endedAt: null },
    include: { rounds: { orderBy: { roundNumber: "asc" } }, standings: true },
  });

  if (!season) {
    const now = new Date();
    const week = Math.ceil(now.getDate() / 7);
    const month = now.toLocaleString("en", { month: "long" });
    const year = now.getFullYear();
    season = await prisma.botSeason.create({
      data: {
        name: `W${week}, ${month} ${year} — ${now.toLocaleDateString("en", { month: "short", day: "numeric" })}`,
        roundCount: SEASON_ROUNDS,
      },
      include: { rounds: { orderBy: { roundNumber: "asc" } }, standings: true },
    });

    const allStats = (await prisma.playerStats.findMany({
      where: { userId: { in: botIds } },
    })) as any[];
    const seasonEloMap = new Map(allStats.map((s: any) => [s.userId, s.elo]));

    for (const botId of botIds) {
      await prisma.botStanding.create({
        data: {
          seasonId: season.id,
          botId,
          matchPoints: 0,
          matchesPlayed: 0,
          tiebreakElo: seasonEloMap.get(botId) ?? 1000,
        },
      });
    }

    season = await prisma.botSeason.findFirst({
      where: { id: season.id },
      include: { rounds: { orderBy: { roundNumber: "asc" } }, standings: true },
    })!;

    console.log(`Created season: ${season!.name}`);
  }

  const ssn = season;
  if (!ssn) return;

  const completedRounds = ssn.rounds.filter((r: any) => r.status === "COMPLETE").length;
  const nextRoundNum = completedRounds + 1;

  if (nextRoundNum > SEASON_ROUNDS) {
    await prisma.botSeason.update({
      where: { id: ssn.id },
      data: { endedAt: new Date() },
    });
    console.log(`Season "${ssn.name}" completed!`);
    return;
  }

  let round: any = ssn.rounds.find((r: any) => r.roundNumber === nextRoundNum);

  if (!round) {
    round = await prisma.botRound.create({
      data: { seasonId: ssn.id, roundNumber: nextRoundNum, status: "PENDING" },
    });
  }

  if (round.status === "COMPLETE") {
    console.log(`Round ${nextRoundNum} already complete.`);
    return;
  }

  const standings = await prisma.botStanding.findMany({
    where: { seasonId: ssn.id },
    orderBy: { matchPoints: "desc" },
  }) as any[];

  const standingsWithElo = standings.map((s: any) => ({
    botId: s.botId,
    matchPoints: s.matchPoints,
    tiebreakElo: s.tiebreakElo, // frozen at season start
  }));

  const pods = swissPairings(
    nextRoundNum === 1 ? shuffle(standingsWithElo) : standingsWithElo,
    POD_SIZE,
  );

  for (const pod of pods) {
    const matchId = `bot_match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    console.log(`  Pod: ${pod.join(", ")} → ${matchId}`);
    await runMatch(matchId, pod);

    const mp = await prisma.matchPlayer.findMany({
      where: { matchId },
      orderBy: { finalRank: "asc" },
    });

    for (let rank = 0; rank < mp.length; rank++) {
      const mpEntry = mp[rank]!;
      const points = [3, 2, 1, 0][rank] ?? 0;

      await prisma.botStanding.update({
        where: { seasonId_botId: { seasonId: season!.id, botId: mpEntry.userId } },
        data: {
          matchPoints: { increment: points },
          matchesPlayed: { increment: 1 },
        },
      });
    }

    await prisma.botMatch.create({
      data: { roundId: round!.id, matchId },
    });
  }

  await prisma.botRound.update({
    where: { id: round!.id },
    data: { status: "COMPLETE" },
  });

  console.log(`Season "${season!.name}" — Round ${nextRoundNum} complete (${pods.length} pods)`);
  const updatedStandings = await prisma.botStanding.findMany({
    where: { seasonId: season!.id },
    orderBy: { matchPoints: "desc" },
  });
  for (const s of updatedStandings.slice(0, 5) as any[]) {
    console.log(`  ${s.matchPoints}pts — ${s.botId}`);
  }
}

botLeague()
  .catch((e) => {
    console.error("Bot league failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
