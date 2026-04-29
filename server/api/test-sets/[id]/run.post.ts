import { prisma } from '~/server/utils/db'
import { batchCallOpenAI } from '~/server/services/openai'
import { batchScore } from '~/server/services/scorer'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = (await readBody(event).catch(() => ({}))) as { model?: string }
  const model = body.model === 'glm-4-plus' ? 'glm-4-plus' : 'glm-4-flash'
  
  // 获取测试集
  const testSet = await prisma.testSet.findUnique({
    where: { id }
  })
  
  if (!testSet) {
    throw createError({
      statusCode: 404,
      message: '用例不存在'
    })
  }
  
  const questions = testSet.questions as string[]
  // 批量调用 AI
  const startTime = Date.now()
  const results = await batchCallOpenAI(questions, model)
  const totalDuration = Date.now() - startTime
  
  // 批量评分
  const qaList = questions.map((q, idx) => ({
    question: q,
    answer: results[idx]?.content || ''
  }))
  const scores = await batchScore(qaList)
  
  // 合并结果
  const finalResults = results.map((result, idx) => {
    const scoreItem = scores[idx]
    return {
      ...result,
      question: questions[idx],
      score: scoreItem?.score ?? null,
      dimensions: scoreItem?.dimensions ?? null,
      reasoning: scoreItem?.reasoning ?? '评分缺失'
    }
  })
  
  // 计算汇总统计
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length
  const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0)
  const avgDuration = totalDuration / questions.length
  
  // 保存评测记录
  const evaluation = await prisma.evaluation.create({
    data: {
      testSetId: id,
      results: finalResults,
      metrics: {
        totalQuestions: questions.length,
        totalDuration,
        averageDuration: avgDuration,
        model,
        averageScore: avgScore,
        totalTokens
      }
    }
  })
  
  return {
    id: evaluation.id,
    testSet: {
      id: testSet.id,
      name: testSet.name
    },
    summary: {
      totalQuestions: questions.length,
      avgScore: avgScore.toFixed(1),
      totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
      totalTokens,
      model
    },
    details: finalResults
  }
})