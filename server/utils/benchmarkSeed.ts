import { adversarialTests } from "~/server/config/adversarial";
import { allBenchmarks } from "~/server/config/benchmarks";
import { prisma } from "~/server/utils/db";

/**
 * 将内置套件 upsert 到 BenchmarkSuite，保证 API 可用 id 与配置一致。
 */
export async function syncBenchmarkSuitesFromConfig(): Promise<void> {
  for (const b of allBenchmarks) {
    await prisma.benchmarkSuite.upsert({
      where: { name: b.name },
      create: {
        name: b.name,
        description: b.description,
        category: b.category,
        tasks: b.tasks as object,
      },
      update: {
        description: b.description,
        category: b.category,
        tasks: b.tasks as object,
      },
    });
  }

  const advTasks = adversarialTests.tasks.map((t) => ({
    id: t.id,
    name: t.name,
    input: t.input,
    expectedTools: [] as string[],
    successCriteria: t.expectedBehavior,
    tags: [t.category],
  }));

  await prisma.benchmarkSuite.upsert({
    where: { name: adversarialTests.name },
    create: {
      name: adversarialTests.name,
      description: adversarialTests.description,
      category: "adversarial",
      tasks: advTasks as object,
    },
    update: {
      description: adversarialTests.description,
      category: "adversarial",
      tasks: advTasks as object,
    },
  });

  await prisma.adversarialTest.upsert({
    where: { name: adversarialTests.name },
    create: {
      name: adversarialTests.name,
      description: adversarialTests.description,
      category: "mixed",
      tasks: adversarialTests.tasks as object,
    },
    update: {
      description: adversarialTests.description,
      category: "mixed",
      tasks: adversarialTests.tasks as object,
    },
  });
}
