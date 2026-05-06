import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getModelConfig } from "~/server/config/models";
import { createChatModel, messageContentToString } from "~/server/services/llm";
import { searchKnowledgeBase } from "~/server/services/knowledgeBase";
import { batchEvaluateToolCalls } from "~/server/services/toolQuality";
import {
  chinaWeatherNowTool,
  formatApisspaceWeatherBodyToZh,
  openAiChinaWeatherNowTool,
  searchTool,
  webSearchOpenAITool,
} from "~/server/tools";
import { extractKnownCityFromQuestion } from "~/server/tools/lib/chinaWeatherAreacode";

/** 流式管线对外事件（与 SSE data 行 JSON 对齐）。 */
export type StreamWithToolsEvent =
  | { type: "content"; content: string }
  | { type: "tool_call"; tool: string; query: string }
  | { type: "tool_result"; tool: string; query: string; content: string }
  | {
      type: "done";
      totalTokens: number;
      duration: number;
      hasToolCall: boolean;
      toolCallCount: number;
      toolSourceCount: number;
      toolAvgScore: number;
      hasKnowledgeHit: boolean;
      trajectory: Array<Record<string, unknown>>;
      toolMetrics: Record<string, unknown>;
      scenario: string | null;
      toolCallInfo: { name: string; query: string } | null;
    }
  | { type: "error"; error: string };

export interface StreamWithToolsPipelineInput {
  question: string;
  model: string;
  enableTools: boolean;
  scenario?: string | null;
  knowledgeBaseId?: string | null;
}

/**
 * 为外部检索增加超时兜底，避免单次工具调用拖垮整条链路。
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs),
    ),
  ]);
}

/**
 * 单题带工具流式管线：产出与 SSE 一致的事件序列，供 HTTP 流式与 Benchmark 聚合共用。
 */
export async function* iterateStreamWithTools(
  input: StreamWithToolsPipelineInput,
): AsyncGenerator<StreamWithToolsEvent> {
  const { question, model, enableTools, scenario, knowledgeBaseId } = input;
  const modelId = model || "glm-4-flash";
  const modelInstance = createChatModel(modelId, { temperature: 0.7 });
  const cfg = getModelConfig(modelId);

  const knowledgeSearchTool = tool(
    async ({ query }) => {
      if (!knowledgeBaseId || typeof knowledgeBaseId !== "string") {
        return "未选择知识库，无法执行知识检索";
      }
      const rows = await searchKnowledgeBase(knowledgeBaseId, query, 3);
      return JSON.stringify({
        knowledgeBaseId,
        query,
        chunks: rows,
      });
    },
    {
      name: "knowledge_search",
      description: "从企业知识库检索与当前问题相关的文档片段",
      schema: z.object({
        query: z.string().describe("要在知识库中检索的关键词或问题"),
      }),
    },
  );

  const openAiKnowledgeTool = {
    type: "function" as const,
    function: {
      name: "knowledge_search",
      description: "从企业知识库检索与当前问题相关的文档片段",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索关键词或问题" },
        },
        required: ["query"],
      },
    },
  };

  const providerCompatibleTools =
    cfg?.provider === "zhipu" || cfg?.provider === "aliyun"
      ? [
          openAiChinaWeatherNowTool,
          webSearchOpenAITool,
          ...(knowledgeBaseId ? [openAiKnowledgeTool] : []),
        ]
      : [
          chinaWeatherNowTool,
          searchTool,
          ...(knowledgeBaseId ? [knowledgeSearchTool] : []),
        ];

  const modelWithTools =
    enableTools !== false
      ? modelInstance.bindTools(providerCompatibleTools, { tool_choice: "auto" })
      : modelInstance;

  const startTime = Date.now();
  const trajectory: Array<Record<string, unknown>> = [];
  let hasToolCall = false;
  let toolCallInfo: { name: string; query: string } | null = null;
  let toolCallCount = 0;
  let toolSourceCount = 0;
  let toolAvgScore = 0;
  let hasKnowledgeHit = false;
  let prefetchedKnowledgeChunks: string[] = [];

  if (knowledgeBaseId && typeof knowledgeBaseId === "string") {
    try {
      prefetchedKnowledgeChunks = await withTimeout(
        searchKnowledgeBase(knowledgeBaseId, question, 3),
        10000,
        "知识库预检索超时",
      );
      if (prefetchedKnowledgeChunks.length > 0) {
        hasKnowledgeHit = true;
        toolSourceCount = Math.max(toolSourceCount, prefetchedKnowledgeChunks.length);
        toolAvgScore = Math.max(toolAvgScore, 1);
      }
    } catch {
      prefetchedKnowledgeChunks = [];
    }
  }

  const knowledgePrefetchPrompt =
    prefetchedKnowledgeChunks.length > 0
      ? `\n\n[知识库预检索证据]\n${prefetchedKnowledgeChunks
          .slice(0, 3)
          .map((item, idx) => `${idx + 1}. ${String(item).slice(0, 300)}`)
          .join("\n")}\n请优先基于以上企业知识回答；若证据不足请明确说明。`
      : "";

  let fullContent = "";
  let toolCallContent = "";

  try {
    const stream = await modelWithTools.stream([
      {
        role: "system",
        content:
          "你是一个智能助手。企业资料问题优先调用 knowledge_search；中国城市「当前实况天气、气温」优先调用 china_weather_now（可传 city 或 areacode）；其他实时信息用 web_search。调用 web_search 时 query 与用户语言一致。回答必须基于工具证据并附来源，证据不足时明确说明。" +
          knowledgePrefetchPrompt,
      },
      { role: "user", content: question },
    ]);

    for await (const chunk of stream) {
      if (chunk.tool_calls && chunk.tool_calls.length > 0) {
        hasToolCall = true;
        for (const tc of chunk.tool_calls) {
          if (
            tc.name === "web_search" ||
            tc.name === "knowledge_search" ||
            tc.name === "china_weather_now"
          ) {
            toolCallCount += 1;
            const rawArgs = tc.args as unknown;
            const args =
              typeof rawArgs === "string"
                ? (JSON.parse(rawArgs) as {
                    query?: string;
                    city?: string;
                    areacode?: string;
                  })
                : (rawArgs as {
                    query?: string;
                    city?: string;
                    areacode?: string;
                  });
            const toolQueryLabel =
              tc.name === "china_weather_now"
                ? args.city || args.areacode || question
                : args.query || question;
            toolCallInfo = { name: tc.name, query: toolQueryLabel };
            trajectory.push({
              step: trajectory.length + 1,
              type: "tool_call",
              toolCall: {
                name: tc.name,
                arguments:
                  tc.name === "china_weather_now"
                    ? JSON.stringify({ city: args.city, areacode: args.areacode })
                    : args.query || question,
              },
              timestamp: Date.now() - startTime,
            });
            yield {
              type: "tool_call",
              tool: tc.name,
              query: toolQueryLabel,
            };

            const searchResult =
              tc.name === "knowledge_search"
                ? await withTimeout(
                    knowledgeSearchTool.invoke({
                      query: args.query || question,
                    }),
                    12000,
                    "知识库检索超时，请稍后重试",
                  )
                : tc.name === "china_weather_now"
                  ? await withTimeout(
                      chinaWeatherNowTool.invoke({
                        city:
                          (typeof args.city === "string" && args.city.trim()) ||
                          extractKnownCityFromQuestion(
                            String(args.query || ""),
                          ) ||
                          extractKnownCityFromQuestion(question) ||
                          undefined,
                        areacode:
                          typeof args.areacode === "string"
                            ? args.areacode.trim() || undefined
                            : undefined,
                      }),
                      8000,
                      "实况天气接口超时",
                    )
                  : await searchTool.invoke({
                      query: args.query || question,
                    });
            try {
              const parsed = JSON.parse(String(searchResult)) as {
                provider?: string;
                ok?: boolean;
                results?: Array<{ score?: number; url?: string }>;
                chunks?: string[];
              };
              if (tc.name === "knowledge_search") {
                const chunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
                hasKnowledgeHit = chunks.length > 0 || hasKnowledgeHit;
                toolSourceCount = chunks.length;
                toolAvgScore = chunks.length > 0 ? 1 : 0;
              } else if (tc.name === "china_weather_now") {
                toolSourceCount = parsed.ok ? 1 : 0;
                toolAvgScore = parsed.ok ? 1 : 0;
              } else {
                const rows = Array.isArray(parsed.results) ? parsed.results : [];
                toolSourceCount = rows.filter((r) => r.url).length;
                const scores = rows
                  .map((r) => Number(r.score || 0))
                  .filter((s) => Number.isFinite(s) && s > 0);
                toolAvgScore =
                  scores.length > 0
                    ? Number(
                        (
                          scores.reduce((sum, s) => sum + s, 0) / scores.length
                        ).toFixed(3),
                      )
                    : 0;
              }
            } catch {
              // ignore parse errors
            }
            toolCallContent += `\n\n[搜索结果]\n${searchResult}`;
            trajectory.push({
              step: trajectory.length + 1,
              type: "tool_result",
              toolResult: searchResult,
              timestamp: Date.now() - startTime,
            });
            let toolResultPreview = String(searchResult || "");
            if (tc.name === "china_weather_now") {
              try {
                const w = JSON.parse(toolResultPreview) as {
                  areacode?: string;
                  city?: string | null;
                  httpStatus?: number;
                  ok?: boolean;
                  raw?: string;
                  error?: string;
                };
                const summary = w.error
                  ? w.error
                  : w.raw
                    ? formatApisspaceWeatherBodyToZh(w.raw)
                    : "无正文";
                toolResultPreview =
                  `实况天气（APISpace | areacode: ${w.areacode || "-"} | city: ${w.city || "-"} | HTTP ${w.httpStatus ?? "-" }）\n` +
                  summary.slice(0, 2500);
              } catch {
                // keep raw
              }
            } else {
              try {
                const parsed = JSON.parse(toolResultPreview) as {
                  serverNow?: { timezone?: string; zh?: string };
                  answer?: string;
                  results?: Array<{ title?: string; url?: string }>;
                  chunks?: string[];
                };
                const clock = parsed.serverNow?.zh
                  ? `服务器当前时间（${parsed.serverNow.timezone || "Asia/Shanghai"}）: ${parsed.serverNow.zh}`
                  : "";
                const refs =
                  tc.name === "knowledge_search"
                    ? Array.isArray(parsed.chunks)
                      ? parsed.chunks
                          .slice(0, 3)
                          .map((item, idx) => `${idx + 1}. ${String(item).slice(0, 120)}`)
                          .join("\n")
                      : "无"
                    : Array.isArray(parsed.results)
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
                  `${
                    tc.name === "knowledge_search"
                      ? "知识库命中摘要"
                      : "联网摘要(可能过时)"
                  }: ${parsed.answer || "无"}\n来源:\n${refs}`;
              } catch {
                // keep raw
              }
            }
            yield {
              type: "tool_result",
              tool: tc.name,
              query: toolQueryLabel,
              content: toolResultPreview,
            };
          }
        }
      }

      const content = messageContentToString(chunk.content);
      if (content) {
        fullContent += content;
        yield { type: "content", content };
      }
    }

    if (toolCallContent) {
      fullContent += toolCallContent;
    }
    trajectory.push({
      step: trajectory.length + 1,
      type: "llm_output",
      llmOutput: fullContent.slice(0, 2000),
      timestamp: Date.now() - startTime,
    });

    const duration = Date.now() - startTime;
    const toolSuccess = toolCallCount > 0 && toolSourceCount > 0 ? toolCallCount : 0;
    let quality: Record<string, unknown> = {
      totalCalls: toolCallCount,
      success: toolSuccess,
      avgScore: toolAvgScore,
      toolQualityScore: Number(
        ((toolCallCount > 0 ? Math.min(toolAvgScore, 1) : 0) * 100).toFixed(2),
      ),
    };
    if (trajectory.length > 0) {
      const toolCalls = trajectory
        .filter((t) => t.type === "tool_call")
        .map((t) => {
          const toolName = String(
            (t.toolCall as { name?: string } | undefined)?.name || "web_search",
          );
          const toolResultStep = trajectory.find(
            (x) =>
              x.type === "tool_result" &&
              String(
                (x.toolCall as { name?: string } | undefined)?.name ||
                  (x.toolName as string | undefined) ||
                  "web_search",
              ) === toolName,
          );
          return {
            toolName,
            toolInput:
              (t.toolCall as { arguments?: unknown } | undefined)?.arguments || "",
            toolResult: String(toolResultStep?.toolResult || ""),
          };
        });
      if (toolCalls.length > 0) {
        const { scores, summary } = await batchEvaluateToolCalls(
          toolCalls,
          question,
          typeof scenario === "string" ? scenario : null,
        );
        quality = {
          success: toolSuccess,
          avgScore: toolAvgScore,
          toolQualityScore: Number(summary.avgOverallScore.toFixed(2)),
          toolQualityScores: scores,
          ...summary,
        };
      }
    }

    yield {
      type: "done",
      totalTokens: Math.ceil(fullContent.length / 4),
      duration,
      hasToolCall,
      toolCallCount,
      toolSourceCount,
      toolAvgScore,
      hasKnowledgeHit,
      trajectory,
      toolMetrics: quality,
      scenario: typeof scenario === "string" ? scenario : null,
      toolCallInfo,
    };
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 消费完整事件流，得到单题最终文本与元数据（Benchmark 等非 SSE 场景）。
 */
export async function collectStreamWithToolsRun(
  input: StreamWithToolsPipelineInput,
): Promise<{
  content: string;
  duration: number;
  trajectory: Array<Record<string, unknown>>;
  toolMetrics: Record<string, unknown>;
  hasToolCall: boolean;
  hasKnowledgeHit: boolean;
  toolCallNames: string[];
  totalTokens: number;
  error?: string;
}> {
  const wallStart = Date.now();
  let content = "";
  const toolCallNames: string[] = [];
  let duration = 0;
  let trajectory: Array<Record<string, unknown>> = [];
  let toolMetrics: Record<string, unknown> = {};
  let hasToolCall = false;
  let hasKnowledgeHit = false;
  let totalTokens = 0;
  let err: string | undefined;

  for await (const ev of iterateStreamWithTools(input)) {
    if (ev.type === "content") content += ev.content;
    if (ev.type === "tool_call") toolCallNames.push(ev.tool);
    if (ev.type === "error") err = ev.error;
    if (ev.type === "done") {
      duration = ev.duration;
      trajectory = ev.trajectory;
      toolMetrics = ev.toolMetrics;
      hasToolCall = ev.hasToolCall;
      hasKnowledgeHit = ev.hasKnowledgeHit;
      totalTokens = ev.totalTokens;
    }
  }

  if (!duration && err) {
    duration = Date.now() - wallStart;
  }

  return {
    content,
    duration,
    trajectory,
    toolMetrics,
    hasToolCall,
    hasKnowledgeHit,
    toolCallNames: [...new Set(toolCallNames)],
    totalTokens,
    error: err,
  };
}
