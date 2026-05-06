-- CreateTable
CREATE TABLE "AdversarialRun" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "byCategory" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdversarialRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdversarialRun_model_idx" ON "AdversarialRun"("model");

-- CreateIndex
CREATE INDEX "AdversarialRun_createdAt_idx" ON "AdversarialRun"("createdAt");
