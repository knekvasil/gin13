import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db";

const router = Router();

const JWT_SECRET = process.env["JWT_SECRET"] || "dev-secret-change-in-production";
const BCRYPT_ROUNDS = 10;

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      res.status(400).json({ error: "email, password, and displayName are required" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "email already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName },
    });

    const token = jwt.sign({ sub: user.id, name: user.displayName }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "invalid email or password" });
      return;
    }

    const token = jwt.sign({ sub: user.id, name: user.displayName }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

export function verifyToken(token: string): { sub: string; name: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; name: string };
  } catch {
    return null;
  }
}

export default router;
