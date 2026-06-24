-- CreateTable
CREATE TABLE "BotSeason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roundCount" INTEGER NOT NULL DEFAULT 7,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "BotSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotRound" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "BotRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotMatch" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,

    CONSTRAINT "BotMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotStanding" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "matchPoints" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "tiebreakElo" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "BotStanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotStanding_seasonId_botId_key" ON "BotStanding"("seasonId", "botId");

-- AddForeignKey
ALTER TABLE "BotRound" ADD CONSTRAINT "BotRound_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BotSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotMatch" ADD CONSTRAINT "BotMatch_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BotRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotStanding" ADD CONSTRAINT "BotStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BotSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
