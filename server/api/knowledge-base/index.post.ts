import { z } from "zod";
import { prisma } from "~/server/utils/db";

const CreateKbSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string().optional(),
  owner: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = CreateKbSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "请求参数错误",
      data: parsed.error.issues,
    });
  }
  return await prisma.knowledgeBase.create({
    data: parsed.data,
  });
});
