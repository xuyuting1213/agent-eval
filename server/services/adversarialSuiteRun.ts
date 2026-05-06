import { adversarialTests, type AdversarialTaskDef } from "~/server/config/adversarial";
import { getModelConfig } from "~/server/config/models";
import { callModel } from "~/server/services/multiProvider";
import { evaluateAdversarialTask } from "~/server/services/adversarialEvaluate";

export interface AdversarialTaskResult {
  taskId: string;
  taskName: string;
  category: string;
  input: string;
  output?: string;
  expectedBehavior: string;
  duration: number;
  toolCalls: string[];
  evaluation?: { success: boolean; score: number; reason: string };
  error?: string;
}

export interface AdversarialSuiteSummary {
  totalTasks: number;
  successRate: number;
  avgScore: number;
  avgDuration: number;
}

export interface AdversarialByCategoryStat {
  total: number;
  success: number;
  successRate: number;
}

/**
 * 顺序跑完内置对抗任务：直连模型 + 规则/评分判定，并汇总分类指标。
 */
export async function executeAdversarialSuite(model: string): Promise<{
  results: AdversarialTaskResult[];
  summary: AdversarialSuiteSummary;
  byCategory: Record<string, AdversarialByCategoryStat>;
}> {
  const cfg = getModelConfig(model);
  if (!cfg) {
    throw new Error(`未知模型: ${model}`);
  }

  const tasks = adversarialTests.tasks as AdversarialTaskDef[];
  const results: AdversarialTaskResult[] = [];

  for (const task of tasks) {
    const startTime = Date.now();
    try {
      const { content } = await callModel(model, task.input);
      const duration = Date.now() - startTime;
      const evaluation = await evaluateAdversarialTask(task, content);
      results.push({
        taskId: task.id,
        taskName: task.name,
        category: task.category,
        input: task.input,
        output: content,
        expectedBehavior: task.expectedBehavior,
        duration,
        toolCalls: [],
        evaluation: {
          success: evaluation.success,
          score: evaluation.score,
          reason: evaluation.reason,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        taskId: task.id,
        taskName: task.name,
        category: task.category,
        input: task.input,
        expectedBehavior: task.expectedBehavior,
        duration: Date.now() - startTime,
        toolCalls: [],
        error: msg,
      });
    }
  }

  const successCount = results.filter((r) => r.evaluation?.success).length;
  const n = results.length || 1;
  const summary: AdversarialSuiteSummary = {
    totalTasks: results.length,
    successRate: successCount / n,
    avgScore:
      results.reduce((sum, r) => sum + (r.evaluation?.score ?? 0), 0) / n,
    avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / n,
  };

  const byCategory: Record<string, AdversarialByCategoryStat> = {};
  for (const result of results) {
    const cat = result.category;
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, success: 0, successRate: 0 };
    }
    byCategory[cat].total += 1;
    if (result.evaluation?.success) {
      byCategory[cat].success += 1;
    }
  }
  for (const v of Object.values(byCategory)) {
    v.successRate = v.total ? v.success / v.total : 0;
  }

  return { results, summary, byCategory };
}
