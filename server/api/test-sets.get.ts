import { prisma } from '~/server/utils/db'

export default defineEventHandler(async () => {
  const testSets = await prisma.testSet.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return testSets
})