import { HumanMessage, type AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { getScenario } from "~/server/config/businessScenarios";
import { createChatModel, messageContentToString } from "~/server/services/llm";

const businessScorerModelId = "glm-4-flash";

const BusinessScoreSchema = z.object({
  dimensions: z.record(z.string(), z.number()),
  overallScore: z.number().min(0).max(100),
  feedback: z.string(),
  recommendations: z.array(z.string()).default([]),
});

export interface BusinessScoreResult {
  overallScore: number;
  dimensions: Record<string, number>;
  feedback: string;
  recommendations: string[];
}

/** 剥离 markdown 围栏后截取首个 JSON 对象文本，便于解析模型输出。 */
function extractJsonObjectText(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return s.slice(start, end + 1);
  }
  return s;
}

/**
 * 按业务场景权重调用模型，输出结构化业务分、维度分与改进建议。
 */
export async function scoreByScenario(
  question: string,
  answer: string,
  scenarioId: string,
): Promise<BusinessScoreResult> {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    throw new Error(`未知的业务场景: ${scenarioId}`);
  }

  const dimensionsPrompt = Object.entries(scenario.weight)
    .map(([dim, weight]) => `${dim} (权重 ${(weight * 100).toFixed(0)}%)`)
    .join(", ");

  const dimensionKeys = Object.keys(scenario.weight);

  const prompt = `你是一个专业的业务评估专家，正在评估一个AI助手在【${scenario.name}】场景下的回答质量。

【业务场景】
${scenario.name}: ${scenario.description}
成功标准: ${scenario.successCriteria}

【评分维度及权重】
${dimensionsPrompt}

【用户问题】
${question}

【AI回答】
${answer}

请根据业务场景的权重，对以下维度逐一评分（0-100分）：
${dimensionKeys.map((d) => `- ${d}`).join("\n")}

同时给出：
1. 综合得分 overallScore（0-100，与各维度及权重一致的加权结果）
2. 总体评价 feedback（一句话）
3. 改进建议 recommendations（2-3条字符串数组）

只输出一个 JSON 对象，不要 markdown 围栏，不要其它说明。字段名：dimensions（对象，键为上述维度英文名）、overallScore、feedback、recommendations。`;

  const chat = createChatModel(businessScorerModelId, { temperature: 0.25, maxTokens: 1200 });
  const response = (await chat.invoke([new HumanMessage(prompt)])) as AIMessage;
  const text = messageContentToString(response.content);
  const jsonText = extractJsonObjectText(text);

  try {
    const parsed = BusinessScoreSchema.safeParse(JSON.parse(jsonText));
    if (!parsed.success) {
      return {
        overallScore: 0,
        dimensions: {},
        feedback: "业务评分格式无效",
        recommendations: ["请重试或检查模型输出"],
      };
    }
    const dims: Record<string, number> = {};
    for (const k of dimensionKeys) {
      const v = parsed.data.dimensions[k];
      if (typeof v === "number") {
        dims[k] = v;
      }
    }
    return {
      overallScore: parsed.data.overallScore,
      dimensions: dims,
      feedback: parsed.data.feedback,
      recommendations: parsed.data.recommendations ?? [],
    };
  } catch (e) {
    console.error("业务评分解析失败:", e);
    return {
      overallScore: 0,
      dimensions: {},
      feedback: "评分失败",
      recommendations: ["请重试"],
    };
  }
}

/**
 * 对多条问答在同一业务场景下顺序执行业务评分（避免压垮上游并发）。
 */
export async function batchBusinessScore(
  qaList: Array<{ question: string; answer: string }>,
  scenarioId: string,
): Promise<BusinessScoreResult[]> {
  const results: BusinessScoreResult[] = [];
  for (const qa of qaList) {
    results.push(await scoreByScenario(qa.question, qa.answer, scenarioId));
  }
  return results;
}
