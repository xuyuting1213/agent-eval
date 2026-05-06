import { z } from "zod";
import { getModelConfig } from "~/server/config/models";
import { prisma } from "~/server/utils/db";
import { executeAdversarialSuite } from "~/server/services/adversarialSuiteRun";

const AdversarialSchema = z.object({
  model: z.string().min(1),
});

/**
 * 跑完整套对抗任务、落库 AdversarialRun，并返回明细与按分类汇总。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = AdversarialSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "参数错误",
      data: parsed.error.flatten(),
    });
  }

  const { model } = parsed.data;
  if (!getModelConfig(model)) {
    throw createError({ statusCode: 400, message: `未知模型: ${model}` });
  }

  const { results, summary, byCategory } = await executeAdversarialSuite(model);

  try {
    await prisma.adversarialRun.create({
      data: {
        model,
        results: results as object,
        summary: summary as object,
        byCategory: byCategory as object,
      },
    });
  } catch (dbError) {
    console.warn("保存对抗测试记录失败:", dbError);
  }

  return {
    model,
    summary,
    byCategory,
    results,
    ranAt: new Date().toISOString(),
  };
});
