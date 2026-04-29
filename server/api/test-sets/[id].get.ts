/**
 * GET /api/test-sets/:id
 * 单个用例详情；不存在返回 404。
 */
import { prisma } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  
  const testSet = await prisma.testSet.findUnique({
    where: { id }
  })
  
  if (!testSet) {
    throw createError({
      statusCode: 404,
      message: '用例不存在'
    })
  }
  
  return testSet
})