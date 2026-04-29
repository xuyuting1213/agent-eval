import { prisma } from '~/server/utils/db'

export default defineEventHandler(async () => {
  // 获取所有评测记录
  const evaluations = await prisma.evaluation.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      metrics: true,
      results: true
    }
  })

  // 按模型统计性能指标
  const performanceByModel: Record<string, {
    totalRequests: number
    successCount: number
    avgDuration: number
    durations: number[]
    avgTokens: number
    tokens: number[]
    dailyData: Record<string, { avgDuration: number; count: number; totalDuration: number }>
  }> = {}

  for (const evalItem of evaluations) {
    const metrics = evalItem.metrics as any
    const results = evalItem.results as any[]
    const model = metrics?.model
    const date = evalItem.createdAt.toISOString().split('T')[0]

    if (!model) continue

    if (!performanceByModel[model]) {
      performanceByModel[model] = {
        totalRequests: 0,
        successCount: 0,
        avgDuration: 0,
        durations: [],
        avgTokens: 0,
        tokens: [],
        dailyData: {}
      }
    }

    // 统计每个请求的耗时和 Token
    if (results && Array.isArray(results)) {
      for (const result of results) {
        if (result.duration && result.duration > 0) {
          performanceByModel[model].durations.push(result.duration)
          performanceByModel[model].totalRequests++
          if (result.content && !result.error) {
            performanceByModel[model].successCount++
          }
        }
        if (result.totalTokens) {
          performanceByModel[model].tokens.push(result.totalTokens)
        }
      }
    }

    // 每日聚合
    if (!performanceByModel[model].dailyData[date]) {
      performanceByModel[model].dailyData[date] = { avgDuration: 0, count: 0, totalDuration: 0 }
    }
    const avgDurationPerRequest = metrics?.averageDuration || 0
    performanceByModel[model].dailyData[date].totalDuration += avgDurationPerRequest * (results?.length || 1)
    performanceByModel[model].dailyData[date].count += results?.length || 1
  }

  // 计算平均值和百分位数
  const modelPerformance = Object.entries(performanceByModel).map(([model, data]) => {
    const sortedDurations = [...data.durations].sort((a, b) => a - b)
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)]
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)]
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)]

    const avgDuration = data.durations.length > 0
      ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
      : 0
    const avgToken = data.tokens.length > 0 
      ? data.tokens.reduce((a, b) => a + b, 0) / data.tokens.length 
      : 0

    // 每日趋势
    const dailyTrend = Object.entries(data.dailyData).map(([date, dayData]) => ({
      date,
      avgDuration: Math.round(dayData.totalDuration / dayData.count),
      count: dayData.count
    })).sort((a, b) => a.date.localeCompare(b.date))

    return {
      model,
      displayName: getModelDisplayName(model),
      totalRequests: data.totalRequests,
      successRate: data.totalRequests > 0 
        ? Number((data.successCount / data.totalRequests * 100).toFixed(1)) 
        : 0,
      avgDuration,
      p50: Math.round(p50 || 0),
      p95: Math.round(p95 || 0 as number),
      p99: Math.round(p99 || 0 as number),
      avgTokens: Math.round(avgToken),
      dailyTrend
    }
  }).sort((a, b) => a.avgDuration - b.avgDuration)

  // 全局性能趋势（近7天）
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentEvals = evaluations.filter((e: any) => e.createdAt >= sevenDaysAgo)
  const dailyGlobalTrend: Record<string, { avgDuration: number; count: number; totalDuration: number }> = {}

  for (const evalItem of recentEvals) {
    const metrics = evalItem.metrics as any
    const results = evalItem.results as any[]
    const date = evalItem.createdAt.toISOString().split('T')[0]

    if (!dailyGlobalTrend[date]) {
      dailyGlobalTrend[date] = { avgDuration: 0, count: 0, totalDuration: 0 }
    }

    const avgDurationPerRequest = metrics?.averageDuration || 0
    dailyGlobalTrend[date].totalDuration += avgDurationPerRequest * (results?.length || 1)
    dailyGlobalTrend[date].count += results?.length || 1
  }

  const globalTrend = Object.entries(dailyGlobalTrend).map(([date, data]) => ({
    date,
    avgDuration: Math.round(data.totalDuration / data.count),
    count: data.count
  })).sort((a, b) => a.date.localeCompare(b.date))

  return {
    summary: {
      totalRequests: modelPerformance.reduce((sum, m) => sum + m.totalRequests, 0),
      avgResponseTime: Math.round(
        modelPerformance.reduce((sum, m) => sum + m.avgDuration, 0) / modelPerformance.length
      ) || 0,
      overallSuccessRate: modelPerformance.length > 0
        ? Number((modelPerformance.reduce((sum, m) => sum + m.successRate, 0) / modelPerformance.length).toFixed(1))
        : 0
    },
    byModel: modelPerformance,
    globalTrend
  }
})

function getModelDisplayName(model: string): string {
  const names: Record<string, string> = {
    'glm-4-flash': 'GLM-4-Flash',
    'glm-4-plus': 'GLM-4-Plus',
    'glm-4-air': 'GLM-4-Air',
    'glm-4-long': 'GLM-4-Long',
    'glm-3-turbo': 'GLM-3-Turbo',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'qwen-turbo': 'Qwen-Turbo',
    'qwen-plus': 'Qwen-Plus'
  }
  return names[model] || model
}