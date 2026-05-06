/**
 * POST /api/evaluations/persist
 * 工作台流式评测落库：新建 TestSet + Evaluation；保存时服务端对每条问答调用 batchScore，与 /api/evaluate 一致写入 score / averageScore。
 * 若带业务场景，则追加业务维度评分与 ROI 测算写入 metrics / 各条 results。
 */
import { z } from "zod";
import { getScenario } from "~/server/config/businessScenarios";
import { prisma } from "~/server/utils/db";
import { batchBusinessScore } from "~/server/services/businessScorer";
import { calculateROI } from "~/server/services/roiCalculator";
import { batchScore } from "~/server/services/scorer";

const PersistSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  model: z.string(),
  questions: z.array(z.string()).min(1),
  results: z.array(z.unknown()),
  trajectory: z.array(z.unknown()).optional(),
  toolMetrics: z.any().optional(),
  scenario: z.string().optional(),
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

  const { name, model, questions, results, trajectory, toolMetrics, scenario, metrics } =
    parsed.data;

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

  const scenarioId = typeof scenario === "string" ? scenario.trim() : "";
  let businessMetrics: Record<string, unknown> = {};
  if (
    scenarioId &&
    getScenario(scenarioId) &&
    qaList.length > 0 &&
    qaList.some((q) => q.answer.trim().length > 0)
  ) {
    try {
      const businessScores = await batchBusinessScore(qaList, scenarioId);
      const avgBusinessScore =
        businessScores.reduce((s, x) => s + x.overallScore, 0) /
        businessScores.length;

      const dimKeys = new Set<string>();
      for (const b of businessScores) {
        Object.keys(b.dimensions).forEach((k) => dimKeys.add(k));
      }
      const businessDimensions: Record<string, number> = {};
      for (const k of dimKeys) {
        const vals = businessScores
          .map((b) => b.dimensions[k])
          .filter((v): v is number => typeof v === "number");
        businessDimensions[k] = vals.length
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : 0;
      }

      const totalTokens = rawRows.reduce((sum, r) => {
        const t =
          typeof (r as { totalTokens?: unknown }).totalTokens === "number"
            ? (r as { totalTokens: number }).totalTokens
            : 0;
        return sum + t;
      }, 0);

      const roi = calculateROI(model, totalTokens, scenarioId, {
        dailyVolume: 100,
        questionCount: questions.length,
      });

      scoredResults = (scoredResults as Array<Record<string, unknown>>).map(
        (row, idx) => ({
          ...row,
          businessScore: businessScores[idx]?.overallScore ?? null,
          businessDimensions: businessScores[idx]?.dimensions ?? null,
          businessFeedback: businessScores[idx]?.feedback ?? null,
          businessRecommendations: businessScores[idx]?.recommendations ?? null,
        }),
      );

      businessMetrics = {
        businessScore: avgBusinessScore,
        businessDimensions,
        businessFeedback: businessScores.map((b) => b.feedback),
        businessRecommendations: [
          ...new Set(businessScores.flatMap((b) => b.recommendations)),
        ],
        roi,
      };
    } catch (e) {
      console.error("业务评分或 ROI 计算失败:", e);
    }
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
      name: name.trim(),
      testSetId: testSet.id,
      results: scoredResults as unknown,
      trajectory: Array.isArray(trajectory) ? (trajectory as unknown) : null,
      toolMetrics:
        typeof toolMetrics === "object" && toolMetrics !== null
          ? (toolMetrics as unknown)
          : null,
      scenario: scenario || null,
      metrics: {
        ...(typeof metrics === "object" && metrics !== null ? metrics : {}),
        model,
        totalQuestions: questions.length,
        source: "workbench-stream",
        averageScore,
        scenario: scenario || null,
        ...businessMetrics,
      },
    },
  });

  return { id: evaluation.id, testSetId: testSet.id };
});
