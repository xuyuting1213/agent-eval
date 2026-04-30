/**
 * POST /api/evaluations/persist
 * 工作台流式评测落库：新建 TestSet + Evaluation；保存时服务端对每条问答调用 batchScore，与 /api/evaluate 一致写入 score / averageScore。
 */
import { z } from "zod";
import { batchScore } from "~/server/services/scorer";
import { prisma } from "~/server/utils/db";

const PersistSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  model: z.string(),
  questions: z.array(z.string()).min(1),
  results: z.array(z.unknown()),
  metrics: z.any().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = PersistSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "请求参数错误",
      data: parsed.error.issues,
    });
  }

  const { name, model, questions, results, metrics } = parsed.data;

  const rawRows = results as Array<Record<string, unknown>>;
  const qaList = questions.map((q, idx) => {
    const row = rawRows[idx] ?? {};
    const content = typeof row.content === "string" ? row.content : "";
    return { question: q, answer: content };
  });

  let scoredResults: unknown[] = rawRows;
  let averageScore = 0;

  try {
    const scores = await batchScore(qaList, 2);
    scoredResults = rawRows.map((result, idx) => {
      const scoreItem = scores[idx];
      return {
        ...result,
        score: scoreItem?.score ?? null,
        dimensions: scoreItem?.dimensions ?? null,
        reasoning: scoreItem?.reasoning ?? "评分缺失",
      };
    });
    averageScore = scores.length
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;
  } catch (error) {
    console.error("persist 评分失败:", error);
    scoredResults = rawRows.map((result) => ({
      ...result,
      score: null,
      dimensions: null,
      reasoning: "评分服务调用失败",
    }));
  }

  const testSet = await prisma.testSet.create({
    data: {
      name: name.trim(),
      description: "工作台流式评测",
      questions: questions as unknown,
    },
  });

  const evaluation = await prisma.evaluation.create({
    data: {
      testSetId: testSet.id,
      results: scoredResults as unknown,
      metrics: {
        ...(typeof metrics === "object" && metrics !== null ? metrics : {}),
        model,
        totalQuestions: questions.length,
        source: "workbench-stream",
        averageScore,
      },
    },
  });

  return { id: evaluation.id, testSetId: testSet.id };
});
