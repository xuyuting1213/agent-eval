import { getModelConfig } from "~/server/config/models";
import { callModel } from "~/server/services/multiProvider";
import { scoreAnswer } from "~/server/services/scorer";
import { collectStreamWithToolsRun } from "~/server/services/streamWithToolsPipeline";

/** 从 Prisma Json 解析出的单条任务结构 */
export interface BenchmarkTaskRow {
  id: string;
  name: string;
  input: string;
  expectedTools?: string[];
  successCriteria?: string;
  tags?: string[];
}

export interface BenchmarkTaskRunResult {
  taskId: string;
  taskName: string;
  input: string;
  output: string;
  success: boolean;
  score: number;
  duration: number;
  totalTokens?: number;
  expectedTools?: string[];
  toolCalls: string[];
  /** chat：无工具直连；tools：走 stream-with-tools 等价管线 */
  runMode?: "chat" | "tools";
  hasKnowledgeHit?: boolean;
  error?: string;
}

const PASS_SCORE = 62;

export interface BenchmarkRunOptions {
  scenario?: string;
  knowledgeBaseId?: string | null;
}

/**
 * 期望工具名是否包含某关键词（配置里可能是 knowledge_base / knowledge_search 混写）。
 */
function expectedToolsMatch(
  expected: string[],
  needle: "web" | "knowledge" | "weather",
): boolean {
  return expected.some((t) => {
    const x = t.toLowerCase();
    if (needle === "web") return x.includes("web");
    if (needle === "knowledge")
      return x.includes("knowledge") || x.includes("知识");
    return x.includes("weather") || x.includes("china_weather");
  });
}

/**
 * 对单条任务：无 expectedTools 时用直连模型；否则走带工具管线再打分。
 */
export async function runSingleBenchmarkTask(
  model: string,
  task: BenchmarkTaskRow,
  opts?: BenchmarkRunOptions,
): Promise<BenchmarkTaskRunResult> {
  const start = Date.now();
  const expected = task.expectedTools ?? [];
  const useTools = expected.length > 0;

  try {
    if (useTools) {
      const pack = await collectStreamWithToolsRun({
        question: task.input,
        model,
        enableTools: true,
        scenario: opts?.scenario ?? "customerService",
        knowledgeBaseId: opts?.knowledgeBaseId ?? null,
      });
      const duration = Date.now() - start;
      if (pack.error) {
        return {
          taskId: task.id,
          taskName: task.name,
          input: task.input,
          output: pack.content || "",
          success: false,
          score: 0,
          duration,
          totalTokens: pack.totalTokens,
          expectedTools: expected,
          toolCalls: pack.toolCallNames,
          runMode: "tools",
          hasKnowledgeHit: pack.hasKnowledgeHit,
          error: pack.error,
        };
      }
      const content = pack.content || "";
      const rubric =
        task.successCriteria?.trim() ||
        "回答应准确、完整、与用户问题相关且表述清晰";
      const scored = await scoreAnswer(
        `${task.input}\n【评判参考】${rubric}`,
        content,
      );
      let success = scored.score >= PASS_SCORE;
      if (
        success &&
        expected.length &&
        expectedToolsMatch(expected, "knowledge") &&
        opts?.knowledgeBaseId &&
        !pack.toolCallNames.includes("knowledge_search") &&
        !pack.hasKnowledgeHit &&
        scored.score < 78
      ) {
        success = false;
      }
      if (
        success &&
        expected.length &&
        expectedToolsMatch(expected, "web") &&
        !pack.toolCallNames.includes("web_search") &&
        scored.score < 70
      ) {
        success = false;
      }
      return {
        taskId: task.id,
        taskName: task.name,
        input: task.input,
        output: content,
        success,
        score: scored.score,
        duration,
        totalTokens: pack.totalTokens,
        expectedTools: expected,
        toolCalls: pack.toolCallNames,
        runMode: "tools",
        hasKnowledgeHit: pack.hasKnowledgeHit,
      };
    }

    const { content, totalTokens } = await callModel(model, task.input);
    const rubric =
      task.successCriteria?.trim() ||
      "回答应准确、完整、与用户问题相关且表述清晰";
    const scored = await scoreAnswer(
      `${task.input}\n【评判参考】${rubric}`,
      content,
    );
    const duration = Date.now() - start;
    return {
      taskId: task.id,
      taskName: task.name,
      input: task.input,
      output: content,
      success: scored.score >= PASS_SCORE,
      score: scored.score,
      duration,
      totalTokens,
      expectedTools: expected,
      toolCalls: [],
      runMode: "chat",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      taskId: task.id,
      taskName: task.name,
      input: task.input,
      output: "",
      success: false,
      score: 0,
      duration: Date.now() - start,
      expectedTools: expected,
      toolCalls: [],
      runMode: useTools ? "tools" : "chat",
      error: msg,
    };
  }
}

/**
 * 校验模型 id 后，顺序执行套件内全部任务并汇总指标（供 API 落库）。
 */
export async function executeBenchmarkSuite(
  model: string,
  tasks: BenchmarkTaskRow[],
  opts?: BenchmarkRunOptions,
): Promise<{
  results: BenchmarkTaskRunResult[];
  summary: {
    totalTasks: number;
    successRate: number;
    avgScore: number;
    avgDuration: number;
  };
}> {
  const cfg = getModelConfig(model);
  if (!cfg) {
    throw new Error(`未知模型: ${model}`);
  }
  const results: BenchmarkTaskRunResult[] = [];
  for (const task of tasks) {
    results.push(await runSingleBenchmarkTask(model, task, opts));
  }
  const n = results.length || 1;
  const successCount = results.filter((r) => r.success).length;
  const summary = {
    totalTasks: results.length,
    successRate: successCount / n,
    avgScore: results.reduce((s, r) => s + r.score, 0) / n,
    avgDuration: results.reduce((s, r) => s + r.duration, 0) / n,
  };
  return { results, summary };
}
