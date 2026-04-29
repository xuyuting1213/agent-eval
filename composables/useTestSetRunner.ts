import { computed, ref, type Ref } from "vue";
import type { TestSetItem } from "~/composables/useTestSetCrud";

interface RunResultDetail {
  question: string;
  content: string;
  score: number;
  duration: number;
  totalTokens: number;
  dimensions?: {
    accuracy?: number;
    completeness?: number;
    relevance?: number;
    clarity?: number;
  };
}

interface RunResult {
  testSet?: { name?: string };
  summary?: {
    totalQuestions?: number;
    avgScore?: number;
    totalDuration?: number;
    totalTokens?: number;
  };
  details?: RunResultDetail[];
}

/**
 * 用例跑批逻辑：负责进度模拟、调用 run API、报告弹窗展示与复制。
 */
export const useTestSetRunner = (
  selectedModel: Ref<"glm-4-flash" | "glm-4-plus">,
  testSets: Ref<TestSetItem[]>,
  message: { error: (text: string) => void; success: (text: string) => void },
) => {
  const running = ref(false);
  const runningTestSetId = ref<number | null>(null);
  const runResult = ref<RunResult | null>(null);
  const showResult = ref(false);
  const showProgress = ref(false);
  const currentProgress = ref(0);
  const totalProgress = ref(0);
  const progressTimer = ref<ReturnType<typeof setInterval> | null>(null);

  const progressPercent = computed(() => {
    if (totalProgress.value <= 0) return 0;
    return Math.min(
      100,
      Math.round((currentProgress.value / totalProgress.value) * 100),
    );
  });

  const currentQuestionText = computed(() => {
    if (!running.value || !runningTestSetId.value || totalProgress.value <= 0) {
      return "";
    }
    const activeSet = testSets.value.find((item) => item.id === runningTestSetId.value);
    if (!activeSet?.questions?.length) return "";
    const questionIndex = Math.min(
      Math.max(currentProgress.value - 1, 0),
      activeSet.questions.length - 1,
    );
    return activeSet.questions[questionIndex] || "";
  });

  const clearProgressTimer = () => {
    if (!progressTimer.value) return;
    clearInterval(progressTimer.value);
    progressTimer.value = null;
  };

  /**
   * 跑批时先做前端进度模拟，再等待后端最终结果；这样用户能实时感知执行状态。
   */
  const runTestSet = async (testSet: TestSetItem) => {
    if (running.value) return;
    running.value = true;
    runningTestSetId.value = testSet.id;
    showProgress.value = true;
    showResult.value = false;
    currentProgress.value = 1;
    totalProgress.value = testSet.questions.length;

    clearProgressTimer();
    if (totalProgress.value > 1) {
      progressTimer.value = setInterval(() => {
        if (!running.value) return;
        if (currentProgress.value < totalProgress.value - 1) {
          currentProgress.value += 1;
        }
      }, 800);
    }

    try {
      const result = await $fetch<RunResult>(`/api/test-sets/${testSet.id}/run`, {
        method: "POST",
        body: { model: selectedModel.value },
      });
      clearProgressTimer();
      currentProgress.value = totalProgress.value;
      setTimeout(() => {
        showProgress.value = false;
        runResult.value = result;
        showResult.value = true;
      }, 300);
    } catch (error: any) {
      console.error("评测失败:", error);
      showProgress.value = false;
      message.error(`评测失败: ${error?.data?.message || error?.message || "未知错误"}`);
    } finally {
      clearProgressTimer();
      running.value = false;
      runningTestSetId.value = null;
    }
  };

  const copyReport = () => {
    if (!runResult.value) return;
    const reportText = `
📊 打分报告：${runResult.value.testSet?.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 问题条数：${runResult.value.summary?.totalQuestions}
⭐ 平均得分：${runResult.value.summary?.avgScore}
⏱️ 总耗时：${runResult.value.summary?.totalDuration}
💰 Token 总数：${runResult.value.summary?.totalTokens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
详细结果：
${runResult.value.details
  ?.map(
    (item, idx) => `
${idx + 1}. ${item.question}
   得分：${item.score}
   耗时：${item.duration}ms
   Tokens：${item.totalTokens}
`,
  )
  .join("\n")}
    `.trim();
    navigator.clipboard.writeText(reportText);
    message.success("报告已复制到剪贴板");
  };

  const closeResult = () => {
    showResult.value = false;
    runResult.value = null;
  };

  return {
    running,
    runningTestSetId,
    runResult,
    showResult,
    showProgress,
    currentProgress,
    totalProgress,
    progressPercent,
    currentQuestionText,
    runTestSet,
    copyReport,
    closeResult,
  };
};
