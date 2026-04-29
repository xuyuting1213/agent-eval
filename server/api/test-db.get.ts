/**
 * GET /api/test-db
 * 开发用：校验数据库可写（插入一条 TestSet 后返回）。生产环境（NODE_ENV=production）应关闭或鉴权，避免滥用。
 */
import pkg from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const PrismaClient = (pkg as { PrismaClient: new (...args: any[]) => any }).PrismaClient
type PrismaClient = InstanceType<typeof PrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString })
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default defineEventHandler(async () => {
  // 测试插入一条数据
  const test = await prisma.testSet.create({
    data: {
      name: '用例',
      questions: [],
    },
  })
  
  return {
    message: '数据库连接成功',
    test,
  }
})