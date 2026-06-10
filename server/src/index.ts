import express from "express";
import http from "http";
import { Server } from "colyseus";
import authRouter from "./auth";
import { GameRoom } from "./rooms/GameRoom";

const app = express();
const server = http.createServer(app);
const gameServer = new Server({ server });

app.use(express.json());
app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

gameServer.define("game_room", GameRoom);

const PORT = Number(process.env.PORT) || 2567;
gameServer.listen(PORT);
console.log(`Server listening on ws://localhost:${PORT}`);
