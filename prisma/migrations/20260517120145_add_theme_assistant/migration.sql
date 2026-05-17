-- CreateTable
CREATE TABLE "ThemeChangeSession" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeChangeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeChangeMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemeChangeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeChangeProposal" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "summary" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThemeChangeSession_shop_idx" ON "ThemeChangeSession"("shop");

-- CreateIndex
CREATE INDEX "ThemeChangeMessage_sessionId_idx" ON "ThemeChangeMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ThemeChangeProposal_shop_idx" ON "ThemeChangeProposal"("shop");

-- CreateIndex
CREATE INDEX "ThemeChangeProposal_sessionId_idx" ON "ThemeChangeProposal"("sessionId");

-- CreateIndex
CREATE INDEX "ThemeChangeProposal_shop_status_idx" ON "ThemeChangeProposal"("shop", "status");

-- AddForeignKey
ALTER TABLE "ThemeChangeMessage" ADD CONSTRAINT "ThemeChangeMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ThemeChangeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeChangeProposal" ADD CONSTRAINT "ThemeChangeProposal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ThemeChangeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
