/**
 * GET /api/evaluations/:id
 * 单条打分记录详情（含关联 TestSet），供详情页展示。
 */
import { prisma } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      testSet: true,
    },
  })

  if (!evaluation) {
    throw createError({
      statusCode: 404,
      message: '记录不存在',
    })
  }

  const results = evaluation.results as unknown[]
  const metrics = evaluation.metrics as any
  const questionList = Array.isArray(evaluation.testSet?.questions)
    ? (evaluation.testSet.questions as unknown[])
    : []

  const formattedResults = results.map((result, idx) => {
    const question = typeof questionList[idx] === 'string'
      ? questionList[idx]
      : `问题 ${idx + 1}`

    return {
      ...(typeof result === 'object' && result !== null ? result : {}),
      question,
    }
  })

  return {
    id: evaluation.id,
    createdAt: evaluation.createdAt,
    results: formattedResults,
    metrics,
  }
})
