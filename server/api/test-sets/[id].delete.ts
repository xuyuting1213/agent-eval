import { prisma } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  
  await prisma.testSet.delete({
    where: { id }
  })
  
  return { success: true }
})