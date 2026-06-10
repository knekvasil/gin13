import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "colyseus";
import authRouter from "./auth";
import statsRouter from "./routes/stats";
import { GameRoom } from "./rooms/GameRoom";

const app = express();
const server = http.createServer(app);
const gameServer = new Server({ server });

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/auth", authRouter);
app.use("/", statsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

gameServer.define("game_room", GameRoom);

const PORT = Number(process.env.PORT) || 2567;
gameServer.listen(PORT);
console.log(`Server listening on ws://localhost:${PORT}`);
