import { adversarialTests } from "~/server/config/adversarial";
import { prisma } from "~/server/utils/db";
import { syncBenchmarkSuitesFromConfig } from "~/server/utils/benchmarkSeed";

/**
 * 返回已同步的 Benchmark 套件、对抗元数据、近期运行与按模型聚合的简易对比数据。
 */
export default defineEventHandler(async () => {
  await syncBenchmarkSuitesFromConfig();

  const suites = await prisma.benchmarkSuite.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const adversarialMeta = await prisma.adversarialTest.findFirst({
    where: { name: adversarialTests.name },
  });

  const recentRuns = await prisma.benchmarkRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { suite: { select: { id: true, name: true, category: true } } },
  });

  const byModel = new Map<
    string,
    { count: number; avgScore: number; successRate: number }
  >();
  for (const run of recentRuns) {
    const sum = run.summary as {
      avgScore?: number;
      successRate?: number;
    } | null;
    const cur = byModel.get(run.model) || {
      count: 0,
      avgScore: 0,
      successRate: 0,
    };
    cur.count += 1;
    cur.avgScore += Number(sum?.avgScore ?? 0);
    cur.successRate += Number(sum?.successRate ?? 0);
    byModel.set(run.model, cur);
  }
  const modelComparison = [...byModel.entries()].map(([model, v]) => ({
    model,
    runs: v.count,
    avgScore: v.count ? v.avgScore / v.count : 0,
    successRate: v.count ? v.successRate / v.count : 0,
  }));

  return {
    suites,
    adversarial: adversarialMeta,
    adversarialPack: adversarialTests,
    recentRuns,
    modelComparison,
  };
});
