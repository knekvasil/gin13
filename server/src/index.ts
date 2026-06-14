import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "colyseus";
import authRouter from "./auth";
import statsRouter from "./routes/stats";
import socialRouter from "./routes/social";
import { GameRoom } from "./rooms/GameRoom";
import { seedBots } from "./seed-bots";

const app = express();
const server = http.createServer(app);
const gameServer = new Server({ server });

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/auth", authRouter);
app.use("/", statsRouter);
app.use("/", socialRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

gameServer.define("game_room", GameRoom);

seedBots().catch((e) => console.error("Bot seed failed", e));

const PORT = Number(process.env.PORT) || 2567;
gameServer.listen(PORT);
console.log(`Server listening on ws://localhost:${PORT}`);
