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
  hasToolCall?: boolean;
  toolCallCount?: number;
  toolSourceCount?: number;
  toolAvgScore?: number;
}

interface StreamChunk {
  type: "content" | "done" | "error" | "tool_call" | "tool_result";
  content?: string;
  error?: string;
  tool?: string;
  query?: string;
  totalTokens?: number;
  duration?: number;
  promptTokens?: number;
  completionTokens?: number;
  hasToolCall?: boolean;
  toolCallCount?: number;
  toolSourceCount?: number;
  toolAvgScore?: number;
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
  /**
   * 将工具返回的 JSON 文本整理成可读摘要，避免直接把长 JSON 塞到回答区。
   */
  const formatToolResult = (raw?: string) => {
    if (!raw) return "无工具结果";
    try {
      const parsed = JSON.parse(raw) as {
        answer?: string;
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      const answer = parsed.answer?.trim() || "无摘要";
      const refs = Array.isArray(parsed.results) ? parsed.results.slice(0, 3) : [];
      const refsText =
        refs.length > 0
          ? refs
              .map(
                (item, idx) =>
                  `${idx + 1}. ${item.title || "无标题"}${item.url ? ` (${item.url})` : ""}`,
              )
              .join("\n")
          : "无来源";
      return `摘要: ${answer}\n来源:\n${refsText}`;
    } catch {
      return raw;
    }
  };
  // 降低突发并发，减少触发模型供应商 429 限流的概率。
  const safeConcurrency = 1;

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

  /** 非 2xx 时尽量读出 Nitro 返回的 JSON/HTML 片段，便于展示与识别 429。 */
  const readFetchErrorDetail = async (response: Response) => {
    try {
      const text = await response.clone().text();
      if (!text) return "";
      try {
        const j = JSON.parse(text) as { message?: string; statusMessage?: string };
        return j.message || j.statusMessage || text;
      } catch {
        return text;
      }
    } catch {
      return "";
    }
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

    if (!response.ok) {
      const detail = await readFetchErrorDetail(response);
      const err = new Error(
        `流式请求失败 (${response.status})${detail ? `: ${detail.slice(0, 400)}` : ""}`,
      ) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    if (!response.body) {
      throw new Error("流式响应无正文（body 为空）");
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

        try {
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
                const tip = `\n[工具调用] ${chunk.tool || "web_search"}: ${chunk.query || question}\n`;
                current.content = (current.content || "") + tip;
              } else if (chunk.type === "tool_result") {
                const resultText = `\n[工具结果]\n${formatToolResult(chunk.content)}\n`;
                current.content = (current.content || "") + resultText;
              } else if (chunk.type === "done") {
                current.totalTokens = chunk.totalTokens || 0;
                current.promptTokens = chunk.promptTokens || 0;
                current.completionTokens = chunk.completionTokens || 0;
                current.duration = chunk.duration || 0;
                current.hasToolCall = Boolean(chunk.hasToolCall);
                current.toolCallCount = Number(chunk.toolCallCount || 0);
                current.toolSourceCount = Number(chunk.toolSourceCount || 0);
                current.toolAvgScore = Number(chunk.toolAvgScore || 0);
                current.streamStatus = "done";
              } else if (chunk.type === "error") {
                current.content = chunk.error || "生成失败";
                current.streamStatus = "error";
              }
            },
            controller.signal,
          );
        } catch (err: unknown) {
          const error = err as { name?: string; status?: number; message?: string };
          if (error?.name === "AbortError") return;

          const current = results.value[resultIndex];
          if (current) {
            current.streamStatus = "error";
            const base = error?.message || "请求失败";
            current.content = (current.content ? `${current.content}\n\n` : "") + `❌ ${base}`;
          }
          return;
        }

        const current = results.value[resultIndex];
        if (current?.streamStatus === "streaming") {
          current.streamStatus = "error";
          current.content =
            (current.content ? `${current.content}\n\n` : "") +
            "❌ 流已结束但未收到完成信号，请重试。";
        }
      });

      await runWithConcurrency(tasks, safeConcurrency);

      const doneN = results.value.filter((r) => r.streamStatus === "done").length;
      const errN = results.value.filter((r) => r.streamStatus === "error").length;
      if (errN > 0 && doneN === 0) {
        const any429 = results.value.some(
          (r) =>
            (r.content && r.content.includes("429")) ||
            (r.content && r.content.includes("速率限制")) ||
            (r.content && r.content.includes("MODEL_RATE_LIMIT")),
        );
        message.error(
          any429
            ? "全部未成功：可能触发模型或网关限流（429），请稍后重试或更换模型。"
            : "全部未成功：请查看各条错误信息或稍后重试。",
        );
      } else if (errN > 0) {
        message.warning(`部分完成：成功 ${doneN} 条，失败 ${errN} 条`);
      } else {
        message.success(`评测完成！共完成 ${questions.length} 条问题`);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        results.value.forEach((r) => {
          if (r.streamStatus === "streaming") {
            r.streamStatus = "error";
            r.content =
              (r.content ? `${r.content}\n\n` : "") +
              `❌ ${error?.data?.message || error?.message || "未知错误"}`;
          }
        });
        message.error(
          `打分失败: ${error?.data?.message || error?.message || "未知错误"}`,
        );
      }
    } finally {
      loading.value = false;
      abortControllers = [];
    }
  };

  /**
   * 保存到历史：流式跑批不会在服务端自动建 Evaluation，首次保存走 persist；
   * 同一次会话内若已有 id，则只更新用例集名称（与旧 /evaluate 流程一致）。
   */
  const saveEvaluation = async () => {
    if (results.value.length === 0 || submittedQuestions.value.length === 0) {
      message.warning("暂无评测结果可保存");
      return;
    }
    const name = `比言_${new Date().toLocaleString()}`;
    try {
      if (evaluationId.value != null) {
        await $fetch(`/api/evaluations/${evaluationId.value}/save`, {
          method: "POST",
          body: { name },
        });
      } else {
        const res = await $fetch<{ id: number }>("/api/evaluations/persist", {
          method: "POST",
          body: {
            name,
            model: selectedModel.value,
            questions: submittedQuestions.value,
            results: results.value,
            metrics: {
              totalQuestions: submittedQuestions.value.length,
              totalDuration: totalDuration.value,
              averageDuration: avgDuration.value,
              totalTokens: totalTokens.value,
              completedCount: completedCount.value,
              enableTools: enableTools.value,
            },
          },
        });
        evaluationId.value = res.id;
      }
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
