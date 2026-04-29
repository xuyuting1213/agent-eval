import { prisma } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  
  const testSet = await prisma.testSet.findUnique({
    where: { id }
  })
  
  if (!testSet) {
    throw createError({
      statusCode: 404,
      message: '测试集不存在'
    })
  }
  
  return testSet
})