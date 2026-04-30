import { getModelConfig } from "~/server/config/models";
import { createChatModel } from "~/server/services/llm";
import { messageContentToString } from "~/server/services/llm";
import { searchTool, webSearchOpenAITool } from "~/server/tools/search";

export default defineEventHandler(async (event) => {
  const { question, model, enableTools } = await readBody(event);

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
  const modelInstance = createChatModel(modelId, {
    temperature: 0.7,
  });

  const cfg = getModelConfig(modelId);
  const toolsForBind =
    cfg?.provider === "zhipu" || cfg?.provider === "aliyun"
      ? [webSearchOpenAITool]
      : [searchTool];

  // 绑定工具（智谱等仅支持 tool_choice=auto；国内兼容网关用原生 parameters，避免 Zod Schema 字段触发 400）
  const modelWithTools =
    enableTools !== false
      ? modelInstance.bindTools(toolsForBind, { tool_choice: "auto" })
      : modelInstance;

  const startTime = Date.now();
  let hasToolCall = false;
  let toolCallInfo: { name: string; query: string } | null = null;
  let toolCallCount = 0;
  let toolSourceCount = 0;
  let toolAvgScore = 0;

  const stream = await modelWithTools.stream([
    {
      role: "system",
      content:
        "你是一个智能助手。当用户询问实时信息、近况、新闻、天气、价格等内容时，优先调用 web_search。若工具返回 serverNow，涉及“今天/当前日期/现在几点”必须以 serverNow 为准；answer 只是搜索引擎合成摘要，可能过时或错误。仅在有证据时下结论，并尽量附来源。",
    },
    { role: "user", content: question },
  ]);

  return sendStream(
    event,
    new ReadableStream({
      async start(controller) {
        let fullContent = "";
        let toolCallContent = "";

        try {
          for await (const chunk of stream) {
            // 检查是否有工具调用
            if (chunk.tool_calls && chunk.tool_calls.length > 0) {
              hasToolCall = true;
              for (const tc of chunk.tool_calls) {
                if (tc.name === "web_search") {
                  toolCallCount += 1;
                  const rawArgs = tc.args as unknown;
                  const args =
                    typeof rawArgs === "string"
                      ? (JSON.parse(rawArgs) as { query?: string })
                      : (rawArgs as { query?: string });
                  toolCallInfo = {
                    name: "web_search",
                    query: args.query || question,
                  };
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ type: "tool_call", tool: "web_search", query: args.query || question })}\n\n`,
                    ),
                  );

                  // 执行搜索
                  const searchResult = await searchTool.invoke({
                    query: args.query || question,
                  });
                  try {
                    const parsed = JSON.parse(String(searchResult)) as {
                      results?: Array<{ score?: number; url?: string }>;
                    };
                    const rows = Array.isArray(parsed.results)
                      ? parsed.results
                      : [];
                    toolSourceCount = rows.filter((r) => r.url).length;
                    const scores = rows
                      .map((r) => Number(r.score || 0))
                      .filter((s) => Number.isFinite(s) && s > 0);
                    toolAvgScore =
                      scores.length > 0
                        ? Number(
                            (
                              scores.reduce((sum, s) => sum + s, 0) /
                              scores.length
                            ).toFixed(3),
                          )
                        : 0;
                  } catch {
                    // 非 JSON 结果不做结构化统计，保持默认值。
                  }
                  toolCallContent = `\n\n[搜索结果]\n${searchResult}`;
                  let toolResultPreview = String(searchResult || "");
                  try {
                    const parsed = JSON.parse(toolResultPreview) as {
                      serverNow?: { timezone?: string; zh?: string };
                      answer?: string;
                      results?: Array<{ title?: string; url?: string }>;
                    };
                    const clock = parsed.serverNow?.zh
                      ? `服务器当前时间（${parsed.serverNow.timezone || "Asia/Shanghai"}）: ${parsed.serverNow.zh}`
                      : "";
                    const refs = Array.isArray(parsed.results)
                      ? parsed.results
                          .slice(0, 3)
                          .map(
                            (item, idx) =>
                              `${idx + 1}. ${item.title || "无标题"}${item.url ? ` (${item.url})` : ""}`,
                          )
                          .join("\n")
                      : "无";
                    toolResultPreview =
                      (clock ? `${clock}\n` : "") +
                      `联网摘要(可能过时): ${parsed.answer || "无"}\n来源:\n${refs}`;
                  } catch {
                    // 保持原始文本
                  }
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ type: "tool_result", content: toolResultPreview })}\n\n`,
                    ),
                  );
                }
              }
            }

            // 正常内容流式输出
            const content = messageContentToString(chunk.content);
            if (content) {
              fullContent += content;
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ type: "content", content })}\n\n`,
                ),
              );
            }
          }

          // 如果有工具调用，追加结果
          if (toolCallContent) {
            fullContent += toolCallContent;
          }

          const duration = Date.now() - startTime;
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                type: "done",
                totalTokens: Math.ceil(fullContent.length / 4),
                duration,
                hasToolCall,
                toolCallCount,
                toolSourceCount,
                toolAvgScore,
                toolCallInfo,
              })}\n\n`,
            ),
          );
          controller.close();
        } catch (error) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "未知错误" })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    }),
  );
});
