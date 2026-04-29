import { computed, ref, type Ref } from "vue";

export interface EvaluationResultItem {
  content?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  duration?: number;
  score?: number;
  dimensions?: {
    accuracy?: number;
    completeness?: number;
    relevance?: number;
    clarity?: number;
  };
  reasoning?: string;
  streamStatus?: "streaming" | "done" | "error";
  toolSource?: "mcp" | "tavily" | "none";
}

interface StreamChunk {
  type: "content" | "done" | "error" | "tool_call" | "tool_result";
  content?: string;
  error?: string;
  tool?: string;
  query?: string;
  toolSource?: "mcp" | "tavily" | "none";
  totalTokens?: number;
  duration?: number;
  promptTokens?: number;
  completionTokens?: number;
}

interface RunnerOptions {
  selectedModel: Ref<string>;
  questionsText: Ref<string>;
  enableTools: Ref<boolean>;
  message: {
    success: (text: string) => void;
    warning: (text: string) => void;
    error: (text: string) => void;
  };
}

export const useEvaluateRunner = (options: RunnerOptions) => {
  const { selectedModel, questionsText, enableTools, message } = options;
  const loading = ref(false);
  const results = ref<EvaluationResultItem[]>([]);
  const submittedQuestions = ref<string[]>([]);
  const evaluationId = ref<number | null>(null);
  let abortControllers: AbortController[] = [];

  const questionCount = computed(
    () => questionsText.value.split("\n").filter((q) => q.trim()).length,
  );
  const completedCount = computed(
    () => results.value.filter((item) => item.streamStatus === "done").length,
  );
  const totalDuration = computed(() =>
    results.value.reduce((sum, r) => sum + (r.duration || 0), 0),
  );
  const avgDuration = computed(() =>
    results.value.length === 0
      ? 0
      : Math.round(totalDuration.value / results.value.length),
  );
  const totalTokens = computed(() =>
    results.value.reduce((sum, r) => sum + (r.totalTokens || 0), 0),
  );

  const cancelEvaluation = () => {
    abortControllers.forEach((controller) => controller.abort());
    abortControllers = [];
    loading.value = false;
    message.warning("已中断评测");

    results.value.forEach((result) => {
      if (result.streamStatus === "streaming") {
        result.streamStatus = "error";
        result.content = result.content || "用户中断";
      }
    });
  };

  const streamOneQuestion = async (
    question: string,
    model: string,
    enableToolsFlag: boolean,
    onChunk: (chunk: StreamChunk) => void,
    signal: AbortSignal,
  ) => {
    const response = await fetch("/api/evaluate/stream-with-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        model,
        enableTools: enableToolsFlag,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`流式请求失败: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const eventText of events) {
        const dataLine = eventText
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload) continue;
        onChunk(JSON.parse(payload) as StreamChunk);
      }
    }
  };

  const runWithConcurrency = async (
    tasks: Array<() => Promise<void>>,
    concurrency = 3,
  ) => {
    let cursor = 0;
    const workers = Array.from({
      length: Math.min(concurrency, tasks.length),
    }).map(async () => {
      while (cursor < tasks.length) {
        const idx = cursor;
        cursor += 1;
        await tasks[idx]();
      }
    });
    await Promise.all(workers);
  };

  const runEvaluation = async () => {
    const questions = questionsText.value
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);

    if (questions.length === 0) {
      message.warning("请至少输入一条问题");
      return;
    }

    abortControllers = [];
    loading.value = true;
    results.value = [];
    submittedQuestions.value = questions;
    evaluationId.value = null;

    try {
      results.value = questions.map(() => ({
        content: "",
        totalTokens: 0,
        duration: 0,
        streamStatus: "streaming" as const,
      }));

      const tasks = questions.map((question, resultIndex) => async () => {
        const controller = new AbortController();
        abortControllers.push(controller);

        await streamOneQuestion(
          question,
          selectedModel.value,
          enableTools.value,
          (chunk) => {
            const current = results.value[resultIndex];
            if (!current) return;

            if (chunk.type === "content") {
              current.content = (current.content || "") + (chunk.content || "");
            } else if (chunk.type === "tool_call") {
              const toolText = `\n[工具调用] ${chunk.tool || "tool"}: ${chunk.query || ""}\n`;
              current.content = (current.content || "") + toolText;
            } else if (chunk.type === "tool_result") {
              const resultText = `\n[工具结果] ${chunk.content || ""}\n`;
              current.content = (current.content || "") + resultText;
              current.toolSource = chunk.toolSource || "none";
            } else if (chunk.type === "done") {
              current.totalTokens = chunk.totalTokens || 0;
              current.promptTokens = chunk.promptTokens || 0;
              current.completionTokens = chunk.completionTokens || 0;
              current.duration = chunk.duration || 0;
              current.toolSource = chunk.toolSource || current.toolSource || "none";
              current.streamStatus = "done";
            } else if (chunk.type === "error") {
              current.content = chunk.error || "生成失败";
              current.streamStatus = "error";
            }
          },
          controller.signal,
        );
      });

      await runWithConcurrency(tasks, 3);
      message.success(`评测完成！共完成 ${questions.length} 条问题`);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        message.error(
          `打分失败: ${error?.data?.message || error?.message || "未知错误"}`,
        );
      }
    } finally {
      loading.value = false;
      abortControllers = [];
    }
  };

  const saveEvaluation = async () => {
    if (!evaluationId.value) {
      message.warning("暂无可保存的结果");
      return;
    }
    try {
      await $fetch(`/api/evaluations/${evaluationId.value}/save`, {
        method: "POST",
        body: { name: `比言_${new Date().toLocaleString()}` },
      });
      message.success("保存成功！可以在历史记录中查看");
    } catch {
      message.error("保存失败");
    }
  };

  const exportResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      model: selectedModel.value,
      questions: questionsText.value.split("\n").filter((q) => q.trim()),
      results: results.value,
      metrics: {
        totalDuration: totalDuration.value,
        avgDuration: avgDuration.value,
        totalTokens: totalTokens.value,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    loading,
    results,
    submittedQuestions,
    evaluationId,
    questionCount,
    completedCount,
    totalDuration,
    avgDuration,
    totalTokens,
    runEvaluation,
    cancelEvaluation,
    saveEvaluation,
    exportResults,
  };
};
