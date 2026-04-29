/**
 * GET /api/test-sets
 * 列出所有用例（TestSet），按创建时间倒序。
 */
import { prisma } from '~/server/utils/db'

export default defineEventHandler(async () => {
  const testSets = await prisma.testSet.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return testSets
})