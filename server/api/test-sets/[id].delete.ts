/**
 * DELETE /api/test-sets/:id
 * 删除指定用例（关联 Evaluation 由 Prisma 级联策略处理，见 schema）。
 */
import { prisma } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  
  await prisma.testSet.delete({
    where: { id }
  })
  
  return { success: true }
})