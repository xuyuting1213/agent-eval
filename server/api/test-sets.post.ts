/**
 * POST /api/test-sets
 * 创建用例：名称、可选描述、问题字符串数组。
 */
import { z } from 'zod'
import { prisma } from '~/server/utils/db'

const TestSetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(z.string()).min(1)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = TestSetSchema.safeParse(body)
  
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: '参数错误' })
  }

  const { name, description, questions } = parsed.data

  const testSet = await prisma.testSet.create({
    data: {
      name,
      description: description || '',
      questions
    }
  })

  return testSet
})