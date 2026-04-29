import { prisma } from '~/server/utils/db'

// 各模型定价（美元/1K tokens）
const pricing: Record<string, { input: number; output: number }> = {
  'glm-4-flash': { input: 0.0006, output: 0.0006 },
  'glm-4-plus': { input: 0.05, output: 0.05 },
  'glm-4-air': { input: 0.005, output: 0.005 },
  'glm-4-long': { input: 0.005, output: 0.005 },
  'glm-3-turbo': { input: 0.001, output: 0.001 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'qwen-turbo': { input: 0.002, output: 0.002 },
  'qwen-plus': { input: 0.004, output: 0.006 }
}

export default defineEventHandler(async () => {
  // 获取所有评测记录
  const evaluations = await prisma.evaluation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  // 统计各模型的总成本和 Token
  const stats: Record<string, { totalCost: number; totalTokens: number; count: number }> = {}

  for (const evalItem of evaluations) {
    const metrics = evalItem.metrics as any
    const model = metrics?.model
    const results = evalItem.results as any[] | null
    const tokensFromMetrics = Number(metrics?.totalTokens || 0)
    const tokensFromResults = Array.isArray(results)
      ? results.reduce((sum, item) => sum + Number(item?.totalTokens || 0), 0)
      : 0
    const totalTokens = tokensFromMetrics > 0 ? tokensFromMetrics : tokensFromResults

    if (!model) continue

    if (!stats[model]) {
      stats[model] = { totalCost: 0, totalTokens: 0, count: 0 }
    }

    const price = pricing[model] || { input: 0.001, output: 0.001 }
    // 简化计算：假设输入输出各一半
    const cost = (totalTokens / 1000) * ((price.input + price.output) / 2)

    stats[model].totalCost += cost
    stats[model].totalTokens += totalTokens
    stats[model].count += 1
  }

  // 按总成本排序
  const sorted = Object.entries(stats)
    .map(([model, data]) => ({
      model,
      ...data,
      avgCostPerRequest: data.totalCost / data.count
    }))
    .sort((a, b) => b.totalCost - a.totalCost)

  return {
    totalCost: sorted.reduce((sum, s) => sum + s.totalCost, 0),
    totalRequests: evaluations.length,
    byModel: sorted
  }
})