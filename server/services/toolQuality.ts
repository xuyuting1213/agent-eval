import { createChatModel, messageContentToString } from "~/server/services/llm";
import { getScenario } from "~/server/config/businessScenarios";

export interface ToolCallRecord {
  toolName: string;
  toolInput: unknown;
  toolResult: string;
  expectedTools?: string[];
}

export interface ToolQualityScore {
  toolSelectionCorrectness: number;
  parameterAccuracy: number;
  resultUtilization: number;
  overallScore: number;
  feedback: string;
}

/**
 * 工具质量评分服务：
 * - 面向单次/批量工具调用做结构化质量评估；
 * - 输出可直接用于评测页与持久化的统一指标。
 */

/**
 * 当 LLM 返回异常或解析失败时，提供稳定兜底分，避免中断主流程。
 */
function fallbackScore(feedback: string): ToolQualityScore {
  return {
    toolSelectionCorrectness: 0.5,
    parameterAccuracy: 3,
    resultUtilization: 3,
    overallScore: 50,
    feedback,
  };
}

/**
 * 规范化 LLM 输出分值范围，保证后续统计不会被越界值污染。
 */
function sanitizeScore(raw: Partial<ToolQualityScore>): ToolQualityScore {
  const toolSelectionCorrectness = Math.min(
    1,
    Math.max(0, Number(raw.toolSelectionCorrectness ?? 0.5)),
  );
  const parameterAccuracy = Math.min(
    5,
    Math.max(1, Math.round(Number(raw.parameterAccuracy ?? 3))),
  );
  const resultUtilization = Math.min(
    5,
    Math.max(1, Math.round(Number(raw.resultUtilization ?? 3))),
  );
  const overallScore =
    raw.overallScore != null
      ? Math.min(100, Math.max(0, Number(raw.overallScore)))
      : Math.round(
          toolSelectionCorrectness * 35 +
            (parameterAccuracy / 5) * 30 +
            (resultUtilization / 5) * 35,
        );
  return {
    toolSelectionCorrectness,
    parameterAccuracy,
    resultUtilization,
    overallScore,
    feedback: String(raw.feedback || "评分成功"),
  };
}

/**
 * 评估单次工具调用质量：构造评分提示词 -> 调模型 -> 解析并规范化。
 */
export async function evaluateToolCall(
  call: ToolCallRecord,
  context: string,
): Promise<ToolQualityScore> {
  const prompt = `你是一个工具调用质量评估专家。请评估以下 AI Agent 的工具调用质量。

【用户问题】${context}

【工具调用】
- 工具名称：${call.toolName}
- 输入参数：${JSON.stringify(call.toolInput)}
- 返回结果：${call.toolResult.slice(0, 500)}${call.toolResult.length > 500 ? "..." : ""}
${call.expectedTools ? `\n【预期工具】${call.expectedTools.join(", ")}` : ""}

请按以下三个维度评分：
1) toolSelectionCorrectness: 0-1
2) parameterAccuracy: 1-5
3) resultUtilization: 1-5

必须返回 JSON 对象（不要 markdown 代码块）：
{
  "toolSelectionCorrectness": 0.8,
  "parameterAccuracy": 4,
  "resultUtilization": 3,
  "overallScore": 75,
  "feedback": "简要原因"
}`;

  try {
    const model = createChatModel("glm-4-flash", { temperature: 0.1 });
    const response = await model.invoke(prompt);
    const content = messageContentToString(response.content)
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(content) as Partial<ToolQualityScore>;
    return sanitizeScore(parsed);
  } catch (error) {
    return fallbackScore(
      `评分解析失败: ${error instanceof Error ? error.message : "未知错误"}`,
    );
  }
}

/**
 * 批量评估工具调用并汇总均值指标，供评测页工具质量看板直接消费。
 */
export async function batchEvaluateToolCalls(
  calls: ToolCallRecord[],
  context: string,
  scenario?: string | null,
) {
  const scenarioConfig = scenario ? getScenario(scenario) : undefined;
  const enriched = calls.map((call) => ({
    ...call,
    expectedTools: call.expectedTools || scenarioConfig?.recommendedTools || [],
  }));
  const scores = await Promise.all(
    enriched.map((call) => evaluateToolCall(call, context)),
  );
  const total = Math.max(scores.length, 1);
  const summary = {
    totalCalls: calls.length,
    avgSelectionCorrectness:
      scores.reduce((sum, s) => sum + s.toolSelectionCorrectness, 0) / total,
    avgParameterAccuracy:
      scores.reduce((sum, s) => sum + s.parameterAccuracy, 0) / total,
    avgResultUtilization:
      scores.reduce((sum, s) => sum + s.resultUtilization, 0) / total,
    avgOverallScore: scores.reduce((sum, s) => sum + s.overallScore, 0) / total,
  };
  return { scores, summary };
}
