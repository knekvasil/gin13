import { prisma } from "./db";

const BOT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta",
  "Echo", "Foxtrot", "Golf", "Hotel",
  "India", "Juliett", "Kilo", "Lima",
  "Mike", "November", "Oscar", "Papa",
  "Quebec", "Romeo", "Sierra", "Tango",
  "Uniform", "Victor", "Whiskey", "X-ray",
];

export async function seedBots(): Promise<void> {
  let count = 0;
  for (let i = 0; i < BOT_NAMES.length; i++) {
    const id = `bot_${i}`;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      await prisma.user.create({
        data: {
          id,
          passwordHash: "",
          displayName: BOT_NAMES[i]!,
        },
      });
      count++;
    }
  }
  if (count > 0) console.log(`Seeded ${count} bot profiles`);
}
