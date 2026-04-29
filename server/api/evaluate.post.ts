// 评价API
import { z } from 'zod'
import { callOpenAI, batchCallOpenAI } from '~/server/services/openai'
import { batchScore } from '~/server/services/scorer'  // 👈 添加评分服务
import { prisma } from '~/server/utils/db'

// 验证请求体
const EvaluateSchema = z.object({
  questions: z.array(z.string()).min(1).max(20),
  model: z.string().default('glm-4-flash'),
  testSetId: z.number().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = EvaluateSchema.safeParse(body)
  
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: '请求参数错误',
      data: parsed.error.issues,
    })
  }
  
  const { questions, model, testSetId } = parsed.data

  const resolvedTestSetId =
    testSetId ??
    (
      await prisma.testSet.create({
        data: {
          name: `Auto TestSet ${new Date().toISOString()}`,
          description: 'Auto-created during evaluate call',
          questions: questions as unknown,
        },
      })
    ).id
  
  // ========== 1. 调用 AI 获取答案 ==========
  const startTime = Date.now()
  let results
  
  try {
    results = await batchCallOpenAI(questions, model)
  } catch (error) {
    const message = error instanceof Error ? error.message : '模型服务调用失败'
    throw createError({
      statusCode: 502,
      statusMessage: 'Evaluate upstream error',
      message,
    })
  }
  
  const totalDuration = Date.now() - startTime
  
  // ========== 2. 对答案进行评分 ==========
  let scoredResults = []
  let averageScore = 0
  
  try {
    // 准备评分数据
    const qaList = questions.map((q, idx) => ({
      question: q,
      answer: results[idx]?.content || '',
    }))
    
    // 调用评分服务
    const scores = await batchScore(qaList)
    
    // 合并结果和评分
    scoredResults = results.map((result, idx) => {
      const scoreItem = scores[idx]
      return {
        ...result,
        score: scoreItem?.score ?? null,
        dimensions: scoreItem?.dimensions ?? null,
        reasoning: scoreItem?.reasoning ?? '评分缺失',
      }
    })
    
    // 计算平均分
    averageScore = scores.length
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0
    
  } catch (error) {
    console.error('评分失败:', error)
    // 评分失败时，结果中没有评分信息
    scoredResults = results.map((result) => ({
      ...result,
      score: null,
      dimensions: null,
      reasoning: '评分服务调用失败',
    }))
  }
  
  // ========== 3. 保存评测结果（包含评分） ==========
  const evaluation = await prisma.evaluation.create({
    data: {
      testSetId: resolvedTestSetId,
      results: scoredResults as unknown,
      metrics: {
        totalQuestions: questions.length,
        totalDuration,
        averageDuration: totalDuration / questions.length,
        model,
        averageScore,  // 👈 添加平均分到 metrics
      },
    },
  })
  
  // ========== 4. 返回结果 ==========
  return {
    id: evaluation.id,
    results: scoredResults,
    metrics: {
      totalDuration,
      averageDuration: totalDuration / questions.length,
      averageScore,
    },
  }
})