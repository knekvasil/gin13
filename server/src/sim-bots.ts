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
} from "./rooms/game-engine";
import { ArraySchema } from "@colyseus/schema";

const BOT_NAMES = ["Alpha","Beta","Gamma","Delta","Echo","Foxtrot","Golf","Hotel"];

function createBotPlayers(state: GameState, count: number): void {
  for (let i = 0; i < count; i++) {
    const bot = new Player();
    bot.sessionId = `bot_${i}`;
    bot.userId = `bot_${i}`;
    bot.name = BOT_NAMES[i] ?? `Bot ${i}`;
    bot.hand = new ArraySchema<CardSchema>();
    bot.board = new ArraySchema<CardSchema>();
    bot.score = 0;
    bot.disconnected = false;
    bot.isBot = true;
    state.players.push(bot);
  }
}

function runSim(totalRounds: number, playerCount: number): void {
  const state = createGameState(totalRounds);
  createBotPlayers(state, playerCount);
  startGame(state);

  let turnCount = 0;
  const MAX_TURNS = 5000;

  while (state.status === "playing" && turnCount < MAX_TURNS) {
    turnCount++;

    if (state.phase === "draw") {
      botPlayTurn(state);
    }

    if (state.phase === "round_ended" && (state.status as string) !== "finished") {
      startNextRound(state);
    }
  }

  const sorted = (Array.from(state.players).filter(Boolean) as Player[]).sort((a, b) => a.score - b.score);
  const winner = sorted[0]!;
  console.log(`\n=== Simulation Complete ===`);
  console.log(`Players: ${playerCount}  |  Rounds: ${totalRounds}  |  Turns: ${turnCount}`);
  console.log(`Winner: ${winner.name} (${winner.score} pts)`);
  console.log(`\nFinal Standings:`);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    console.log(`  ${i + 1}. ${p.name} — ${p.score} pts`);
  }
}

const ROUNDS = Number(process.argv[2]) || 13;
const PLAYERS = Number(process.argv[3]) || 4;

console.log(`Simulating ${ROUNDS} rounds with ${PLAYERS} players...`);
runSim(ROUNDS, PLAYERS);
