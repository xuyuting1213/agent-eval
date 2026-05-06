import { z } from "zod";
import { searchKnowledgeBase } from "~/server/services/knowledgeBase";

const SearchSchema = z.object({
  query: z.string().min(1, "query 不能为空"),
  k: z.number().int().min(1).max(10).optional(),
});

export default defineEventHandler(async (event) => {
  const knowledgeBaseId = event.context.params?.id;
  if (!knowledgeBaseId) {
    throw createError({ statusCode: 400, message: "知识库 ID 缺失" });
  }
  const body = await readBody(event);
  const parsed = SearchSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "请求参数错误",
      data: parsed.error.issues,
    });
  }
  const rows = await searchKnowledgeBase(
    knowledgeBaseId,
    parsed.data.query,
    parsed.data.k ?? 3,
  );
  return { items: rows };
});
