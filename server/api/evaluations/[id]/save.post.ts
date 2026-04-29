import { z } from 'zod'
import { prisma } from '~/server/utils/db'

const SaveSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100, '名称过长'),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      message: '无效的记录 ID',
    })
  }

  const body = await readBody(event)
  const parsed = SaveSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: '请求参数错误',
      data: parsed.error.issues,
    })
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: { id: true, testSetId: true },
  })

  if (!evaluation) {
    throw createError({
      statusCode: 404,
      message: '记录不存在',
    })
  }

  await prisma.testSet.update({
    where: { id: evaluation.testSetId },
    data: {
      name: parsed.data.name.trim(),
    },
  })

  return {
    success: true,
    id: evaluation.id,
    name: parsed.data.name.trim(),
  }
})
