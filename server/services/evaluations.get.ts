/**
 * 与 `server/api/evaluations.get.ts` 列表逻辑相近的服务层副本（若仅 API 使用可考虑合并到一处）。
 */
import { prisma } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 10
  const skip = (page - 1) * pageSize

  const [evaluations, total] = await Promise.all([
    prisma.evaluation.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        testSet: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.evaluation.count(),
  ])

  // 格式化返回数据
  const formattedEvaluations = evaluations.map((evalItem: any) => {
    const metrics = evalItem.metrics as any
    return {
      id: evalItem.id,
      name: evalItem.testSet?.name || `比言 ${evalItem.id}`,
      createdAt: evalItem.createdAt,
      totalQuestions: metrics?.totalQuestions || 0,
      averageScore: metrics?.averageScore || 0,
      averageDuration: metrics?.averageDuration || 0,
      model: metrics?.model || 'glm-4-flash',
    }
  })

  return {
    data: formattedEvaluations,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
})