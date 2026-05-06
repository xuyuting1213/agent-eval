<template>
  <EvaluateSkeleton v-if="initialLoading" />

  <div v-else class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <main class="mx-auto max-w-[1720px] px-6 py-6 space-y-6">
      <WorkbenchControlPanel
        :loading="loading"
        :question-count="questionCount"
        :completed-count="completedCount"
        :enable-tools="enableTools"
        :questions-text="questionsText"
        :selected-model="selectedModel"
        :selected-scenario="selectedScenario"
        :selected-knowledge-base="selectedKnowledgeBase"
        :scenarios="scenarios"
        :knowledge-bases="knowledgeBases"
        :model-options="modelOptions"
        @run="runEvaluation"
        @cancel="cancelEvaluation"
        @clear="clearQuestions"
        @update:enable-tools="enableTools = $event"
        @update:questions-text="questionsText = $event"
        @update:selected-model="selectedModel = $event"
        @update:selected-scenario="selectedScenario = $event"
        @update:selected-knowledge-base="selectedKnowledgeBase = $event"
      />
      <WorkbenchResultsPanel
        :loading="loading"
        :saving-history="savingHistory"
        :results="results"
        :submitted-questions="submittedQuestions"
        :total-duration="totalDuration"
        :avg-duration="avgDuration"
        :total-tokens="totalTokens"
        @export="exportResults"
        @save="saveEvaluation"
      />
    </main>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import EvaluateSkeleton from "~/components/skeletons/EvaluateSkeleton.vue";
import WorkbenchControlPanel from "~/components/workbench/WorkbenchControlPanel.vue";
import WorkbenchResultsPanel from "~/components/workbench/WorkbenchResultsPanel.vue";
import { modelOptions } from "~/composables/useModelOptions";
import { useEvaluateRunner } from "~/composables/useEvaluateRunner";
import { useMessage } from "naive-ui";
const enableTools = ref(false);
const selectedScenario = ref("customerService");
const selectedKnowledgeBase = ref<string | null>(null);
const scenarios = ref<
  Array<{ id: string; name: string; description: string; icon: string }>
>([]);
const knowledgeBases = ref<
  Array<{ id: string; name: string; _count?: { documents: number; chunks: number } }>
>([]);
const message = useMessage();
const questionsText = ref(
"北京今天天气如何？");
const selectedModel = ref("glm-4.7-flash");
const initialLoading = ref(true);

const {
  loading,
  savingHistory,
  results,
  submittedQuestions,
  questionCount,
  completedCount,
  totalDuration,
  avgDuration,
  totalTokens,
  runEvaluation,
  cancelEvaluation,
  saveEvaluation,
  exportResults,
} = useEvaluateRunner({
  selectedModel,
  questionsText,
  enableTools,
  selectedScenario,
  selectedKnowledgeBase,
  message,
});

const loadScenarios = async () => {
  try {
    const endpoint = "/api/business/scenarios";
    const rows = await $fetch(endpoint as string);
    scenarios.value = Array.isArray(rows)
      ? (rows as Array<{
          id: string;
          name: string;
          description: string;
          icon: string;
        }>)
      : [];
    if (
      scenarios.value.length > 0 &&
      !scenarios.value.some((s) => s.id === selectedScenario.value)
    ) {
      selectedScenario.value = scenarios.value[0].id;
    }
  } catch {
    scenarios.value = [];
  }
};

/** 加载知识库列表，供评测阶段选择 RAG 检索源。 */
const loadKnowledgeBases = async () => {
  try {
    const rows = await $fetch("/api/knowledge-base");
    knowledgeBases.value = Array.isArray(rows)
      ? (rows as Array<{
          id: string;
          name: string;
          _count?: { documents: number; chunks: number };
        }>)
      : [];
  } catch {
    knowledgeBases.value = [];
  }
};

// 清空输入问题，避免模板中引用未定义方法
const clearQuestions = () => {
  questionsText.value = "";
};

onMounted(() => {
  const route = useRoute();
  const modelFromQuery = route.query.model;
  const isValidModel =
    typeof modelFromQuery === "string" &&
    modelOptions.some((model) => model.value === modelFromQuery);
  if (isValidModel) {
    selectedModel.value = modelFromQuery;
  }

  const saved = sessionStorage.getItem("testQuestions");
  if (saved) {
    questionsText.value = saved;
    sessionStorage.removeItem("testQuestions");
  }
  loadScenarios();
  loadKnowledgeBases();

  setTimeout(() => {
    initialLoading.value = false;
  }, 500);
});
</script>

<style scoped>
.whitespace-pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
