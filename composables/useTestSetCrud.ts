import { computed, ref } from "vue";

export interface TestSetItem {
  id: number;
  name: string;
  questions: string[];
  createdAt: string;
}

/**
 * 用例 CRUD 逻辑：负责列表加载、新建、删除和“使用该用例”导航。
 */
export const useTestSetCrud = (
  message: { warning: (text: string) => void; success: (text: string) => void; error: (text: string) => void },
  dialog: {
    warning: (options: {
      title: string;
      content: string;
      positiveText: string;
      negativeText: string;
      onPositiveClick: () => void;
      onNegativeClick: () => void;
      onClose: () => void;
    }) => void;
  },
) => {
  const testSets = ref<TestSetItem[]>([]);
  const loading = ref(false);
  const newTestSet = ref({
    name: "",
    questionsText: "",
  });

  const questionCount = computed(
    () =>
      newTestSet.value.questionsText
        .split("\n")
        .filter((q) => q.trim()).length,
  );

  const loadTestSets = async () => {
    loading.value = true;
    try {
      testSets.value = await $fetch<TestSetItem[]>("/api/test-sets");
    } catch (error) {
      console.error("加载测试集失败:", error);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 新建用例时进行最小校验，保证后端收到的 questions 总是非空字符串数组。
   */
  const createTestSet = async () => {
    if (!newTestSet.value.name) {
      message.warning("请填写用例名称");
      return;
    }
    const questions = newTestSet.value.questionsText
      .split("\n")
      .filter((q) => q.trim());
    if (questions.length === 0) {
      message.warning("请至少输入一条问题");
      return;
    }
    try {
      await $fetch("/api/test-sets", {
        method: "POST",
        body: {
          name: newTestSet.value.name,
          questions,
        },
      });
      newTestSet.value = { name: "", questionsText: "" };
      await loadTestSets();
      message.success("创建成功");
    } catch (error) {
      console.error("创建失败:", error);
      message.error("创建失败");
    }
  };

  const useTestSet = (testSet: TestSetItem, selectedModel: string) => {
    sessionStorage.setItem("testQuestions", testSet.questions.join("\n"));
    navigateTo({ path: "/", query: { model: selectedModel } });
  };

  const deleteTestSet = async (id: number) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      dialog.warning({
        title: "确认删除",
        content: "确定删除这份用例吗？",
        positiveText: "删除",
        negativeText: "取消",
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
      });
    });
    if (!confirmed) return;
    try {
      await $fetch(`/api/test-sets/${id}`, { method: "DELETE" });
      await loadTestSets();
      message.success("删除成功");
    } catch (error) {
      console.error("删除失败:", error);
      message.error("删除失败");
    }
  };

  return {
    testSets,
    loading,
    newTestSet,
    questionCount,
    loadTestSets,
    createTestSet,
    useTestSet,
    deleteTestSet,
  };
};
