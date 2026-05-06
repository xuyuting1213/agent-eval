import { prisma } from "~/server/utils/db";

/**
 * 返回最近对抗测试运行的摘要列表（不含完整 results，减轻体积）。
 */
export default defineEventHandler(async () => {
  const runs = await prisma.adversarialRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      model: true,
      summary: true,
      createdAt: true,
    },
  });

  type Row = { id: string; model: string; summary: unknown; createdAt: Date };
  return runs.map((run: Row) => ({
    id: run.id,
    model: run.model,
    summary: run.summary,
    createdAt: run.createdAt,
  }));
});
