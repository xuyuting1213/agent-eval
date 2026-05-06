-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "name" TEXT,
ADD COLUMN     "scenario" TEXT,
ADD COLUMN     "toolMetrics" JSONB,
ADD COLUMN     "trajectory" JSONB,
ALTER COLUMN "testSetId" DROP NOT NULL;
