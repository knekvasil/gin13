import express from "express";
import http from "http";
import { Server } from "colyseus";

const app = express();
const server = http.createServer(app);
const gameServer = new Server({ server });

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = Number(process.env.PORT) || 2567;
gameServer.listen(PORT);
console.log(`Server listening on ws://localhost:${PORT}`);
