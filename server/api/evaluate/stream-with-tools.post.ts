import { iterateStreamWithTools } from "~/server/services/streamWithToolsPipeline";

/**
 * 流式评测 HTTP 入口：将管线事件编码为 SSE，供工作台消费。
 */
export default defineEventHandler(async (event) => {
  const { question, model, enableTools, scenario, knowledgeBaseId } =
    await readBody(event);

  if (!question) {
    throw createError({ statusCode: 400, message: "question is required" });
  }

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const modelId = model || "glm-4-flash";

  return sendStream(
    event,
    new ReadableStream({
      async start(controller) {
        try {
          for await (const ev of iterateStreamWithTools({
            question,
            model: modelId,
            enableTools: enableTools !== false,
            scenario: typeof scenario === "string" ? scenario : null,
            knowledgeBaseId:
              typeof knowledgeBaseId === "string" ? knowledgeBaseId : null,
          })) {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify(ev)}\n\n`),
            );
          }
        } catch (error) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "未知错误",
              })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    }),
  );
});
