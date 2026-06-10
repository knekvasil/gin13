import { PrismaClient } from "../generated/prisma/client.js";

const accelerateUrl = process.env["DATABASE_URL"];

function createClient(): PrismaClient {
  if (accelerateUrl) {
    return new PrismaClient({ accelerateUrl });
  }
  return new (PrismaClient as any)();
}

export const prisma = createClient();
