import path from "path";
import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";
import { Server } from "colyseus";
import authRouter from "./auth";
import statsRouter from "./routes/stats";
import socialRouter from "./routes/social";
import { GameRoom } from "./rooms/GameRoom";
import { seedBots } from "./seed-bots";
import { prisma } from "./db";

const app = express();
const server = http.createServer(app);
const gameServer = new Server({ server });

process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaught exception:", err);
  gameServer.gracefullyShutdown(false).catch(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandled rejection:", reason);
});

process.on("SIGTERM", async () => {
  console.log("[SHUTDOWN] SIGTERM received, shutting down gracefully...");
  await gameServer.gracefullyShutdown(false);
  await prisma.$disconnect();
  process.exit(0);
});

const CORS_ORIGIN = process.env["CORS_ORIGIN"] || "http://localhost:5173";
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(morgan("short"));
app.use("/auth", authRouter);
app.use("/", statsRouter);
app.use("/", socialRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const clientDist = path.join(__dirname, "../../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

gameServer.define("game_room", GameRoom);

seedBots().catch((e) => console.error("Bot seed failed", e));

const PORT = Number(process.env.PORT) || 2567;
gameServer.listen(PORT);
console.log(`Server listening on ws://localhost:${PORT}`);
