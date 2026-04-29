// 对比模型API
import { z } from 'zod'
import { callModel } from '~/server/services/multiProvider'
import { batchScore } from '~/server/services/scorer'

const CompareSchema = z.object({
  questions: z.array(z.string()).min(1).max(10),
  models: z.array(z.string()).min(2).max(5),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = CompareSchema.safeParse(body)
  
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: '参数错误',
      data: parsed.error.issues,
    })
  }
  
  const { questions, models } = parsed.data
  
  // 并发调用所有模型
  const startTime = Date.now()
  
  const modelResults = await Promise.all(
    models.map(async (model) => {
      try {
        const modelStartTime = Date.now()
        const answers = await Promise.all(
          questions.map((question) => callModel(model, question))
        )
        const duration = Date.now() - modelStartTime
        
        // 对答案进行评分
        const qaList = questions.map((q, idx) => ({
          question: q,
          answer: answers[idx]?.content || '',
        }))
        const scores = await batchScore(qaList)
        
        return {
          model,
          available: true,
          answers: answers.map((answer, idx) => {
            const scoreItem = scores[idx]
            return {
              question: questions[idx],
              answer: answer.content,
              tokens: answer.totalTokens,
              duration: answer.duration,
              cost: answer.cost,
              score: scoreItem?.score ?? null,
              dimensions: scoreItem?.dimensions ?? null,
            }
          }),
          summary: {
            totalDuration: duration,
            averageScore: scores.length
              ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
              : 0,
            totalTokens: answers.reduce((sum, a) => sum + a.totalTokens, 0),
            totalCost: answers.reduce((sum, a) => sum + a.cost, 0),
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '模型调用失败'
        return {
          model,
          available: false,
          error: message,
          answers: [],
          summary: {
            totalDuration: 0,
            averageScore: 0,
            totalTokens: 0,
            totalCost: 0,
          },
        }
      }
    })
  )
  
  const totalDuration = Date.now() - startTime
  
  return {
    models: modelResults,
    summary: {
      totalDuration,
      questionsCount: questions.length,
      modelsCount: models.length,
    },
  }
})