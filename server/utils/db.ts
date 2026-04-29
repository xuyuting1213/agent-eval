/**
 * Prisma 单例 + PostgreSQL（@prisma/adapter-pg）。
 * 供所有 `server/api/*` 与 `server/services/*` 通过 `import { prisma } from '~/server/utils/db'` 访问数据库。
 * 依赖环境变量 `DATABASE_URL`；开发环境下挂到 `globalThis` 避免热重载多实例。
 */
import { PrismaPg } from '@prisma/adapter-pg'
import pkg from '@prisma/client'
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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
