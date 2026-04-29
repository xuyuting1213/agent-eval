import { computed, ref } from "vue";
import { useCompareModels } from "~/composables/useCompareModels";

interface CompareSummary {
  averageScore: number;
  totalDuration: number;
  totalTokens: number;
  totalCost?: number;
  avgAccuracy?: number;
  avgCompleteness?: number;
  avgRelevance?: number;
  avgClarity?: number;
}

interface CompareAnswer {
  answer?: string;
  score?: number;
  duration?: number;
  tokens?: number;
  reasoning?: string;
  dimensions?: {
    accuracy?: number;
    completeness?: number;
    relevance?: number;
    clarity?: number;
  };
}

interface CompareModelResult {
  model: string;
  displayName: string;
  available?: boolean;
  error?: string;
  summary: CompareSummary;
  answers: CompareAnswer[];
}

interface ConfigStatus {
  zhipu: boolean;
  openai: boolean;
  dashscope: boolean;
}

/**
 * 横评主流程状态机：管理问题输入、模型选择、API 调用、结果衍生数据与导出行为。
 */
export const useCompareWorkbench = () => {
  const { zhipuModels, getModelDisplayName } = useCompareModels();
  const questionsText = ref("");
  const selectedModels = ref<string[]>(["glm-4-flash", "glm-4-plus"]);
  const loading = ref(false);
  const compareResults = ref<CompareModelResult[]>([]);
  const showTestSetModal = ref(false);
  const testSets = ref<Array<{ id: number; name: string; questions: string[] }>>([]);
  const configStatus = ref<ConfigStatus>({
    zhipu: false,
    openai: false,
    dashscope: false,
  });
  const completedCount = ref(0);

  const questionsList = computed(() =>
    questionsText.value.split("\n").filter((q) => q.trim()),
  );
  const questionsCount = computed(() => questionsList.value.length);
  const totalCalls = computed(
    () => selectedModels.value.length * questionsCount.value,
  );
  const sortedResults = computed(() =>
    [...compareResults.value].sort(
      (a, b) => (b.summary?.averageScore || 0) - (a.summary?.averageScore || 0),
    ),
  );
  const radarData = computed(() =>
    compareResults.value.map((model) => {
      const count = model.answers.length || 1;
      const avgAccuracy =
        model.answers.reduce((sum, a) => sum + (a.dimensions?.accuracy || 0), 0) /
        count;
      const avgCompleteness =
        model.answers.reduce(
          (sum, a) => sum + (a.dimensions?.completeness || 0),
          0,
        ) / count;
      const avgRelevance =
        model.answers.reduce((sum, a) => sum + (a.dimensions?.relevance || 0), 0) /
        count;
      const avgClarity =
        model.answers.reduce((sum, a) => sum + (a.dimensions?.clarity || 0), 0) /
        count;
      return {
        name: model.displayName,
        value: [avgAccuracy, avgCompleteness, avgRelevance, avgClarity],
        dimensions: ["准确性", "完整性", "相关性", "清晰度"],
      };
    }),
  );

  const selectAllModels = () => {
    selectedModels.value = zhipuModels.map((m) => m.value);
  };
  const deselectAllModels = () => {
    selectedModels.value = [];
  };
  const clearQuestions = () => {
    questionsText.value = "";
  };

  /**
   * 从服务端读取用例列表并打开弹窗。失败时不抛出异常，避免打断用户当前输入。
   */
  const loadFromTestSet = async () => {
    try {
      testSets.value = await $fetch<Array<{ id: number; name: string; questions: string[] }>>(
        "/api/test-sets",
      );
      showTestSetModal.value = true;
    } catch (error) {
      console.error("加载测试集失败:", error);
    }
  };

  const selectTestSet = (testSet: { questions?: string[] }) => {
    if (Array.isArray(testSet.questions)) {
      questionsText.value = testSet.questions.join("\n");
    }
    showTestSetModal.value = false;
  };

  /**
   * 执行横评：做最小前置校验后请求 `/api/compare`，并补齐展示所需 displayName。
   */
  const runCompare = async () => {
    const questions = questionsList.value;
    if (questions.length === 0) {
      alert("请至少输入一条问题");
      return;
    }
    if (selectedModels.value.length < 2) {
      alert("请至少选择 2 个模型参与横评");
      return;
    }

    loading.value = true;
    completedCount.value = 0;
    compareResults.value = [];
    try {
      const response = await $fetch<{ models: Array<Omit<CompareModelResult, "displayName">> }>(
        "/api/compare",
        {
          method: "POST",
          body: { questions, models: selectedModels.value },
        },
      );

      compareResults.value = (response.models || []).map((m) => ({
        ...m,
        displayName: getModelDisplayName(m.model),
      }));
      completedCount.value = totalCalls.value;
    } catch (error: any) {
      console.error("对比失败:", error);
      alert(`横评失败: ${error?.data?.message || error?.message || "未知错误"}`);
    } finally {
      loading.value = false;
    }
  };

  const resetCompare = () => {
    compareResults.value = [];
    questionsText.value = "";
  };

  /**
   * 导出完整横评数据为 JSON，便于复盘与离线分享。
   */
  const exportCompareResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      questions: questionsList.value,
      models: compareResults.value.map((m) => ({
        model: m.model,
        displayName: m.displayName,
        summary: m.summary,
        answers: m.answers,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compare_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCompareResults = () => {
    const text = compareResults.value
      .map((m) => {
        if (m.available === false || m.error) {
          return `${m.displayName}: 调用失败（${m.error || "未知错误"}）`;
        }
        return `${m.displayName}: ${m.summary.averageScore.toFixed(1)}分`;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    alert("已复制汇总结果到剪贴板");
  };

  const loadConfigStatus = async () => {
    try {
      configStatus.value = await $fetch<ConfigStatus>("/api/config-status");
    } catch (e) {
      console.error("加载配置状态失败:", e);
    }
  };

  return {
    questionsText,
    selectedModels,
    loading,
    compareResults,
    showTestSetModal,
    testSets,
    configStatus,
    completedCount,
    questionsList,
    questionsCount,
    totalCalls,
    sortedResults,
    radarData,
    selectAllModels,
    deselectAllModels,
    clearQuestions,
    loadFromTestSet,
    selectTestSet,
    runCompare,
    resetCompare,
    exportCompareResults,
    copyCompareResults,
    loadConfigStatus,
  };
};
