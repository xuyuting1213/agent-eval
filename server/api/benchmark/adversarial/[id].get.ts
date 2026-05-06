import { prisma } from "~/server/utils/db";

/**
 * 按 id 返回单次对抗测试的完整记录（供历史详情弹窗）。
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "缺少 id" });
  }

  const run = await prisma.adversarialRun.findUnique({
    where: { id },
  });

  if (!run) {
    throw createError({ statusCode: 404, message: "记录不存在" });
  }

  return {
    id: run.id,
    model: run.model,
    results: run.results,
    summary: run.summary,
    byCategory: run.byCategory,
    createdAt: run.createdAt,
  };
});
