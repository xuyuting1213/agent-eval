import { z } from "zod";
import { getModelConfig } from "~/server/config/models";
import {
  executeBenchmarkSuite,
  type BenchmarkTaskRow,
} from "~/server/services/benchmarkRun";
import { prisma } from "~/server/utils/db";
import { syncBenchmarkSuitesFromConfig } from "~/server/utils/benchmarkSeed";

const RunBenchmarkSchema = z.object({
  suiteId: z.string().min(1),
  model: z.string().min(1),
  scenario: z.string().optional(),
  knowledgeBaseId: z.string().nullable().optional(),
});

/**
 * 按套件 id 跑批 Benchmark：逐任务调用模型并打分，写入 BenchmarkRun。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = RunBenchmarkSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "参数错误",
      data: parsed.error.flatten(),
    });
  }

  await syncBenchmarkSuitesFromConfig();

  const { suiteId, model, scenario, knowledgeBaseId } = parsed.data;
  if (!getModelConfig(model)) {
    throw createError({ statusCode: 400, message: `未知模型: ${model}` });
  }

  const suite = await prisma.benchmarkSuite.findUnique({
    where: { id: suiteId },
  });
  if (!suite) {
    throw createError({ statusCode: 404, message: "测试套件不存在" });
  }

  const rawTasks = suite.tasks as unknown;
  if (!Array.isArray(rawTasks)) {
    throw createError({ statusCode: 500, message: "套件任务格式无效" });
  }

  const { results, summary } = await executeBenchmarkSuite(
    model,
    rawTasks as BenchmarkTaskRow[],
    {
      scenario: scenario ?? "customerService",
      knowledgeBaseId: knowledgeBaseId ?? null,
    },
  );

  const run = await prisma.benchmarkRun.create({
    data: {
      suiteId: suite.id,
      model,
      results: results as object,
      summary: summary as object,
    },
    include: {
      suite: { select: { id: true, name: true, category: true } },
    },
  });

  return run;
});
