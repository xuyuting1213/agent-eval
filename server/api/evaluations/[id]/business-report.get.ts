import { getScenario, type BusinessScenario } from "~/server/config/businessScenarios";
import { prisma } from "~/server/utils/db";

type Metrics = Record<string, unknown>;

/**
 * 根据业务分与 ROI 生成面向决策者的短结论（不含敏感内部信息）。
 */
function generateDecision(
  metrics: Metrics,
  scenarioConfig: BusinessScenario | undefined,
): string {
  const businessScore = Number(metrics.businessScore) || 0;
  const roi = metrics.roi as { roi?: number } | null | undefined;
  const roiPct = typeof roi?.roi === "number" ? roi.roi : null;

  if (businessScore >= 80) {
    if (roiPct !== null && roiPct > 100) {
      return `强烈推荐：业务得分较高（${businessScore.toFixed(0)} 分），ROI 估算 ${roiPct.toFixed(0)}%，可结合试点上线。`;
    }
    return `推荐使用：业务得分较高（${businessScore.toFixed(0)} 分），符合「${scenarioConfig?.name ?? "该场景"}」预期方向。`;
  }
  if (businessScore >= 60) {
    return `可考虑：业务得分中等（${businessScore.toFixed(0)} 分），建议优化提示词或知识库后复测。`;
  }
  return `不推荐：业务得分偏低（${businessScore.toFixed(0)} 分），当前回答与「${scenarioConfig?.name ?? "业务"}」目标差距较大。`;
}

/**
 * GET /api/evaluations/:id/business-report — 聚合 metrics 中的业务分、ROI 与逐题摘要供决策页展示。
 */
export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, "id");
  const id = parseInt(idParam || "0", 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, message: "无效 id" });
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: { testSet: true },
  });

  if (!evaluation) {
    throw createError({ statusCode: 404, message: "评测不存在" });
  }

  const metrics = (evaluation.metrics || {}) as Metrics;
  const results = Array.isArray(evaluation.results)
    ? (evaluation.results as unknown[])
    : [];
  const scenarioKey =
    (typeof evaluation.scenario === "string" && evaluation.scenario) ||
    (typeof metrics.scenario === "string" && metrics.scenario) ||
    "customerService";
  const scenarioConfig = getScenario(scenarioKey);

  const questionList = Array.isArray(evaluation.testSet?.questions)
    ? (evaluation.testSet!.questions as unknown[])
    : [];

  const resultsSummary = results.map((r, idx) => {
    const row = typeof r === "object" && r !== null ? (r as Record<string, unknown>) : {};
    const q =
      typeof questionList[idx] === "string"
        ? (questionList[idx] as string)
        : `问题 ${idx + 1}`;
    const content =
      typeof row.content === "string"
        ? row.content
        : typeof row.answer === "string"
          ? row.answer
          : "";
    return {
      question: q,
      score: row.score,
      businessScore: row.businessScore,
      answerPreview: content.slice(0, 200),
    };
  });

  const recommendationsRaw = metrics.businessRecommendations;
  const recommendations = Array.isArray(recommendationsRaw)
    ? (recommendationsRaw as string[])
    : [];

  return {
    id: evaluation.id,
    name: evaluation.name ?? evaluation.testSet?.name ?? `评测_${evaluation.id}`,
    createdAt: evaluation.createdAt,
    scenario: {
      id: scenarioKey,
      name: scenarioConfig?.name ?? "通用",
      description: scenarioConfig?.description ?? "",
      successCriteria: scenarioConfig?.successCriteria ?? "",
    },
    businessScore: Number(metrics.businessScore) || 0,
    businessDimensions:
      (metrics.businessDimensions as Record<string, number>) || {},
    roi: metrics.roi ?? null,
    resultsSummary,
    recommendations,
    feedbackList: Array.isArray(metrics.businessFeedback)
      ? (metrics.businessFeedback as string[])
      : [],
    decision: generateDecision(metrics, scenarioConfig),
  };
});
