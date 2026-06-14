import http from "http";
import { Room } from "colyseus";
import { verifyToken } from "../auth";
import { prisma } from "../db";
import { Player, createGameState, CardSchema } from "./GameState";
import type { GameState } from "./GameState";
import {
  startGame,
  drawFromDeck,
  drawFromDiscard,
  meldCards,
  passMeld,
  discardCard,
  addToMeld,
  swapWild,
  endRound,
  startNextRound,
  endMatch,
  autoPlayTurn,
  botPlayTurn,
  calculateRoundScores,
} from "./game-engine";
import { ArraySchema } from "@colyseus/schema";

const RECONNECT_TIMEOUT_MS = 60_000;
const TURN_TIMEOUT_MS = 60_000;

export class GameRoom extends Room<GameState> {
  private disconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;

  static async onAuth(token: string, _req: http.IncomingMessage) {
    const payload = verifyToken(token);
    if (!payload) return false;
    return { userId: payload.sub, name: payload.name };
  }

  async onCreate(options: any) {
    this.maxClients = 4;
    this.autoDispose = false;
    const totalRounds = options.totalRounds || 13;

    this.setState(createGameState(totalRounds));

    await prisma.match.create({
      data: {
        id: this.roomId,
        totalRounds,
        status: "WAITING",
      },
    });

    this.setMetadata({ totalRounds, players: 0 });

    const botNames = ["Alpha","Beta","Gamma","Delta","Echo","Foxtrot","Golf","Hotel","India","Juliett","Kilo","Lima"];
    const botCount = options.bots ?? 0;
    for (let i = 0; i < botCount; i++) {
      const profileIdx = (this.state.players.length - botCount + i) % 12;
      const botId = `bot_${profileIdx}`;
      const botName = botNames[profileIdx]!;

      const bot = new Player();
      bot.sessionId = botId;
      bot.userId = botId;
      bot.name = botName;
      bot.hand = new ArraySchema<CardSchema>();
      bot.board = new ArraySchema<CardSchema>();
      bot.score = 0;
      bot.disconnected = false;
      bot.isBot = true;
      this.state.players.push(bot);

      // Ensure bot has a database profile
      // Bot user should already exist from seed; upsert as safety
      await prisma.user.upsert({
        where: { id: botId },
        update: {},
        create: {
          id: botId,
          passwordHash: "",
          displayName: botName,
        },
      });

      await prisma.matchPlayer.upsert({
        where: { matchId_userId: { matchId: this.roomId, userId: botId } },
        update: {},
        create: {
          matchId: this.roomId,
          userId: botId,
          score: 0,
        },
      });

      this.setMetadata({ totalRounds, players: this.state.players.length });
    }

    this.onMessage("start_game", (_client) => {
      if (this.state.players.length < 2) return;
      startGame(this.state);
      this.afterTurnAction();
    });

    this.onMessage("draw", (client, msg: { source: "deck" | "discard" }) => {
      try {
        if (msg.source === "discard") {
          drawFromDiscard(this.state, client.sessionId);
        } else {
          drawFromDeck(this.state, client.sessionId);
        }
        this.restartTurnTimer();
      } catch {}
    });

    this.onMessage("meld", (client, msg: { cardIndices: number[] }) => {
      try {
        meldCards(this.state, client.sessionId, msg.cardIndices);
      } catch (e) {
        client.send("meld_error", { message: (e as Error).message });
      }
    });

    this.onMessage("pass_meld", (client) => {
      try {
        passMeld(this.state, client.sessionId);
        this.restartTurnTimer();
      } catch {}
    });

    this.onMessage("discard", (client, msg: { cardIndex: number }) => {
      try {
        discardCard(this.state, client.sessionId, msg.cardIndex);
        this.afterTurnAction();
      } catch {}
    });

    this.onMessage("add_to_meld", (client, msg: { cardIndex: number; meldGroupId: string; preferSwap?: boolean; position?: "start" | "end" }) => {
      try {
        addToMeld(this.state, client.sessionId, msg.cardIndex, msg.meldGroupId, msg.preferSwap, msg.position);
      } catch (e) {
        client.send("meld_error", { message: (e as Error).message });
      }
    });

    this.onMessage("swap_wild", (client, msg: { meldGroupId: string; meldCardIndex: number; handCardIndex: number }) => {
      try {
        swapWild(this.state, client.sessionId, msg.meldGroupId, msg.meldCardIndex, msg.handCardIndex);
      } catch (e) {
        client.send("meld_error", { message: (e as Error).message });
      }
    });
  }

  private async afterTurnAction(): Promise<void> {
    this.clearTurnTimer();

    let iterations = 0;
    while (iterations < 100) {
      iterations++;

      if (this.state.phase === "round_ended") {
        await this.persistRoundResults();
        // Let clients see the round_ended board state for celebration animations
        await new Promise((r) => setTimeout(r, 2000));
        startNextRound(this.state);
      }

      if (this.state.status === "finished") {
        await this.persistMatchEnd();
        return;
      }

      if (
        this.state.status === "playing" &&
        this.state.phase === "draw"
      ) {
        const current = this.state.players[this.state.currentPlayerIndex];
        if (current?.disconnected) {
          autoPlayTurn(this.state);
          continue;
        }
        if (current?.isBot) {
          await new Promise((r) => setTimeout(r, 1000));
          botPlayTurn(this.state);
          continue;
        }
      }

      break;
    }

    if (this.state.status === "playing") {
      this.startTurnTimer();
    }
  }

  private restartTurnTimer(): void {
    this.clearTurnTimer();
    this.startTurnTimer();
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private startTurnTimer(): void {
    if (this.state.status !== "playing") return;
    if (this.state.phase === "waiting") return;

    this.turnTimer = setTimeout(() => {
      if (this.state.status !== "playing") return;
      autoPlayTurn(this.state);
      this.afterTurnAction().catch(() => {});
    }, TURN_TIMEOUT_MS);
  }

  private async persistRoundResults(): Promise<void> {
    const scores = calculateRoundScores(this.state);
    for (const player of this.state.players) {
      const handScore = scores.get(player.sessionId) ?? 0;
      await prisma.roundResult.create({
        data: {
          matchId: this.roomId,
          roundNumber: this.state.currentRound + 1,
          wildRank: this.state.wildRank,
          playerId: player.userId,
          handScore,
        },
      }).catch(() => {});
    }
  }

  private computeEloDeltas(rankedPlayers: { userId: string; currentElo: number }[]): Map<string, number> {
    const K = 32;
    const deltas = new Map<string, number>();
    const count = new Map<string, number>();

    for (let i = 0; i < rankedPlayers.length; i++) {
      for (let j = i + 1; j < rankedPlayers.length; j++) {
        const higher = rankedPlayers[i];
        const lower = rankedPlayers[j];
        const expected = 1 / (1 + Math.pow(10, (lower.currentElo - higher.currentElo) / 400));
        deltas.set(higher.userId, (deltas.get(higher.userId) ?? 0) + K * (1 - expected));
        deltas.set(lower.userId, (deltas.get(lower.userId) ?? 0) + K * (0 - (1 - expected)));
        count.set(higher.userId, (count.get(higher.userId) ?? 0) + 1);
        count.set(lower.userId, (count.get(lower.userId) ?? 0) + 1);
      }
    }

    for (const userId of deltas.keys()) {
      const c = count.get(userId) ?? 1;
      deltas.set(userId, Math.round(deltas.get(userId)! / c));
    }
    return deltas;
  }

  private async persistMatchEnd(): Promise<void> {
    type RoundResultRow = { playerId: string; roundNumber: number; handScore: number };
    const roundResults = (await prisma.roundResult.findMany({
      where: { matchId: this.roomId },
    })) as unknown as RoundResultRow[];

    const roundWinsPerPlayer = new Map<string, number>();
    const maxHandScorePerPlayer = new Map<string, number>();
    const opponentScoresInWonRounds = new Map<string, number[]>();

    const roundsByNumber = new Map<number, RoundResultRow[]>();
    for (const rr of roundResults) {
      const group = roundsByNumber.get(rr.roundNumber) ?? [];
      group.push(rr);
      roundsByNumber.set(rr.roundNumber, group);
    }

    for (const entries of roundsByNumber.values()) {
      const minScore = Math.min(...entries.map((e: RoundResultRow) => e.handScore));
      const winners = entries.filter((e: RoundResultRow) => e.handScore === minScore);
      for (const winner of winners) {
        const prev = roundWinsPerPlayer.get(winner.playerId) ?? 0;
        roundWinsPerPlayer.set(winner.playerId, prev + 1);

        const oppSum = entries
          .filter((e: RoundResultRow) => e.playerId !== winner.playerId)
          .reduce((s: number, e: RoundResultRow) => s + e.handScore, 0);
        const arr = opponentScoresInWonRounds.get(winner.playerId) ?? [];
        arr.push(oppSum);
        opponentScoresInWonRounds.set(winner.playerId, arr);
      }
      for (const entry of entries) {
        const prev = maxHandScorePerPlayer.get(entry.playerId) ?? 0;
        if (entry.handScore > prev) {
          maxHandScorePerPlayer.set(entry.playerId, entry.handScore);
        }
      }
    }

    const sortedPlayers = [...this.state.players].sort((a: any, b: any) => a.score - b.score);
    const rankedPlayers = sortedPlayers.map((p: any, i: number) => ({ player: p, rank: i + 1 }));
    const winDiff = sortedPlayers.length >= 2 ? (sortedPlayers[1] as any).score - (sortedPlayers[0] as any).score : 0;

    const userIds = rankedPlayers.map((rp: any) => rp.player.userId);
    const existingStats = await prisma.playerStats.findMany({
      where: { userId: { in: userIds } },
    });
    const eloMap = new Map<string, number>(existingStats.map((s: any) => [s.userId, s.elo]));

    const eloInputs = rankedPlayers.map((rp: any) => ({
      userId: rp.player.userId,
      currentElo: eloMap.get(rp.player.userId) ?? 1000,
    }));
    const eloDeltas = this.computeEloDeltas(eloInputs);

    for (const entry of rankedPlayers) {
      const p: any = (entry as any).player;
      const rank: number = (entry as any).rank;

      const matchPlayer = await prisma.matchPlayer.findUnique({
        where: { matchId_userId: { matchId: this.roomId, userId: p.userId } },
      });
      if (!matchPlayer) continue;

      const eloBefore = eloMap.get(p.userId) ?? 1000;
      const eloDelta = eloDeltas.get(p.userId) ?? 0;

      await prisma.matchPlayer.update({
        where: { id: matchPlayer.id },
        data: { score: p.score, finalRank: rank, eloBefore, eloDelta },
      });

      const roundWins = roundWinsPerPlayer.get(p.userId) ?? 0;
      const biggestRoundLoss = maxHandScorePerPlayer.get(p.userId) ?? null;
      const opponentPoints = opponentScoresInWonRounds.get(p.userId) ?? [];
      const maxOpponentPoints = opponentPoints.length > 0 ? Math.max(...opponentPoints) : null;
      const isWin = rank === 1;

      const existing = await prisma.playerStats.findUnique({
        where: { userId: p.userId },
      });

      await prisma.playerStats.upsert({
        where: { userId: p.userId },
        create: {
          userId: p.userId,
          elo: 1000 + eloDelta,
          totalMatches: 1,
          wins: isWin ? 1 : 0,
          totalScore: p.score,
          roundWins,
          biggestRoundLoss,
          mostRoundsWonInAGame: roundWins || null,
          maxOpponentPointsInWonRound: maxOpponentPoints,
          biggestGameWin: isWin ? p.score : null,
          biggestGameLoss: !isWin ? p.score : null,
          biggestWinDiff: isWin ? winDiff : null,
        },
        update: {
          elo: { increment: eloDelta },
          totalMatches: { increment: 1 },
          wins: isWin ? { increment: 1 } : undefined,
          totalScore: { increment: p.score },
          roundWins: { increment: roundWins },
          biggestRoundLoss: biggestRoundLoss != null && (existing?.biggestRoundLoss == null || biggestRoundLoss > existing.biggestRoundLoss)
            ? { set: biggestRoundLoss }
            : undefined,
          mostRoundsWonInAGame: roundWins > 0 && (existing?.mostRoundsWonInAGame == null || roundWins > existing.mostRoundsWonInAGame)
            ? { set: roundWins }
            : undefined,
          maxOpponentPointsInWonRound: maxOpponentPoints != null && (existing?.maxOpponentPointsInWonRound == null || maxOpponentPoints > existing.maxOpponentPointsInWonRound)
            ? { set: maxOpponentPoints }
            : undefined,
          biggestGameWin: isWin && (existing?.biggestGameWin == null || p.score < existing.biggestGameWin)
            ? { set: p.score }
            : undefined,
          biggestGameLoss: !isWin && (existing?.biggestGameLoss == null || p.score > existing.biggestGameLoss)
            ? { set: p.score }
            : undefined,
          biggestWinDiff: isWin && (existing?.biggestWinDiff == null || winDiff > existing.biggestWinDiff)
            ? { set: winDiff }
            : undefined,
        },
      });

      await prisma.playerMatchResult.create({
        data: {
          userId: p.userId,
          matchId: this.roomId,
          rank,
          score: p.score,
          roundsWon: roundWins,
          endedAt: new Date(),
        },
      });
    }

    await prisma.match.update({
      where: { id: this.roomId },
      data: { status: "FINISHED", endedAt: new Date() },
    });
  }

  async onJoin(client: any, _options: any) {
    const existingPlayer = this.state.players.find(
      (p) => p.userId === client.auth.userId,
    );
    if (existingPlayer) {
      existingPlayer.sessionId = client.sessionId;
      existingPlayer.disconnected = false;

      const timeout = this.disconnectTimeouts.get(client.auth.userId);
      if (timeout) {
        clearTimeout(timeout);
        this.disconnectTimeouts.delete(client.auth.userId);
      }

      this.setMetadata({
        totalRounds: this.state.totalRounds,
        players: this.clients.length,
      });
      return;
    }

    const player = new Player();
    player.sessionId = client.sessionId;
    player.userId = client.auth.userId;
    player.name = client.auth.name;
    player.hand = new ArraySchema<CardSchema>();
    player.board = new ArraySchema<CardSchema>();
    player.score = 0;
    player.disconnected = false;
    this.state.players.push(player);

    const existing = await prisma.matchPlayer.findUnique({
      where: { matchId_userId: { matchId: this.roomId, userId: client.auth.userId } },
    });
    if (!existing) {
      await prisma.matchPlayer.create({
        data: { matchId: this.roomId, userId: client.auth.userId },
      });
    }

    this.setMetadata({
      totalRounds: this.state.totalRounds,
      players: this.clients.length,
    });

    prisma.user.update({
      where: { id: client.auth.userId },
      data: { lastSeen: new Date() },
    }).catch(() => {});

    // Auto-start if bots are present
    if (this.state.players.some((p) => p.isBot)) {
      const humanCount = this.state.players.filter((p) => !p.isBot).length;
      if (humanCount >= 1) {
        setTimeout(() => {
          if (this.state.status === "waiting") {
            startGame(this.state);
            this.afterTurnAction().catch(() => {});
          }
        }, 500);
      }
    }
  }

  onLeave(client: any) {
    const player = this.state.players.find(
      (p) => p.sessionId === client.sessionId,
    );
    if (!player) return;

    const userId = player.userId;
    player.disconnected = true;

    this.setMetadata({
      totalRounds: this.state.totalRounds,
      players: Math.max(0, this.clients.length - 1),
    });

    prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() },
    }).catch(() => {});

    const timeoutMs = this.clients.length <= 1 ? 10_000 : RECONNECT_TIMEOUT_MS;

    const timeout = setTimeout(() => {
      this.disconnectTimeouts.delete(userId);

      const idx = this.state.players.findIndex((p) => p.userId === userId);
      if (idx !== -1) {
        this.state.players.splice(idx, 1);
      }

      if (this.state.players.length === 0) {
        this.disconnect().catch(() => {});
      }
    }, timeoutMs);

    this.disconnectTimeouts.set(userId, timeout);
  }

  async onDispose() {
    for (const timeout of this.disconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.disconnectTimeouts.clear();
    this.clearTurnTimer();

    await prisma.match.update({
      where: { id: this.roomId },
      data: { status: "FINISHED", endedAt: new Date() },
    });
  }
}
