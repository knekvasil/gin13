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

const BOT_NAMES = ["Alpha","Beta","Gamma","Delta","Echo","Foxtrot","Golf","Hotel","India","Juliett","Kilo","Lima"];

async function runBotMatch(totalRounds: number, playerCount: number): Promise<void> {
  await seedBots();

  const matchId = `bot_match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  await prisma.match.create({
    data: { id: matchId, totalRounds, status: "ACTIVE" },
  });

  const state = createGameState(totalRounds);
  const bots: Player[] = [];

  for (let i = 0; i < playerCount; i++) {
    const botId = `bot_${i}`;
    const botName = BOT_NAMES[i] ?? `Bot ${i}`;

    const bot = new Player();
    bot.sessionId = botId;
    bot.userId = botId;
    bot.name = botName;
    bot.hand = new ArraySchema<CardSchema>();
    bot.board = new ArraySchema<CardSchema>();
    bot.score = 0;
    bot.disconnected = false;
    bot.isBot = true;
    state.players.push(bot);
    bots.push(bot);

    await prisma.matchPlayer.upsert({
      where: { matchId_userId: { matchId, userId: botId } },
      update: {},
      create: { matchId, userId: botId, score: 0 },
    });
  }

  startGame(state);

  let turnCount = 0;
  const MAX_TURNS = 5000;

  while (state.status === "playing" && turnCount < MAX_TURNS) {
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

  console.log(`Bot match complete: ${matchId} — ${playerCount}p, ${totalRounds}r, ${turnCount}t`);
  for (const bot of bots) {
    const p = state.players.find((bp) => bp && bp.userId === bot.userId);
    if (p) console.log(`  ${p.name}: ${p.score} pts`);
  }
}

const ROUNDS = Number(process.argv[2]) || 13;
const PLAYERS = Number(process.argv[3]) || 4;
const COUNT = Number(process.argv[4]) || 1;

(async () => {
  console.log(`Running ${COUNT} bot matches (${ROUNDS} rounds, ${PLAYERS} players)...`);
  for (let i = 0; i < COUNT; i++) {
    await runBotMatch(ROUNDS, PLAYERS);
  }
  console.log("Done.");
  await prisma.$disconnect();
})().catch((e) => {
  console.error("Bot cron failed:", e);
  process.exit(1);
});
