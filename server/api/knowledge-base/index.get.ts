import { prisma } from "~/server/utils/db";

export default defineEventHandler(async () => {
  return await prisma.knowledgeBase.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { documents: true, chunks: true } },
    },
  });
});
