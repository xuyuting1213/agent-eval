<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 头部 -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <h1 class="text-2xl font-bold text-gray-800">比言 · 工作台</h1>
        <p class="text-gray-500 text-sm mt-1">
          同一批追问下对比各模型回答，按统一维度打分，方便选型与留痕
        </p>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- 左侧：输入区 -->
        <div class="space-y-6">
          <!-- 问题输入 -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              📝 追问
              <span class="text-gray-400 text-xs ml-2">每行一条（会发给模型）</span>
              <NuxtLink
                :to="{ path: '/test-sets', query: { model: selectedModel } }"
                class="text-sm text-blue-500 hover:text-blue-600"
              >
                📋 从用例载入
              </NuxtLink>
            </label>
            <textarea
              v-model="questionsText"
              rows="8"
              class="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如：
什么是 Vue 3 的 Composition API？
解释一下 JavaScript 的闭包
React 和 Vue 有什么区别？"
            />
            <div class="text-xs text-gray-400 mt-2">
              共 {{ questionCount }} 条追问
            </div>
          </div>

          <!-- 模型选择 -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">
              🧠 选择模型
            </label>
            <div class="space-y-2">
              <label
                class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  v-model="selectedModel"
                  value="glm-4-flash"
                  class="w-4 h-4"
                />
                <div>
                  <div class="font-medium">GLM-4-Flash</div>
                  <div class="text-xs text-gray-400">题量多、要快速出结果时更合适</div>
                </div>
              </label>
              <label
                class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  v-model="selectedModel"
                  value="glm-4-plus"
                  class="w-4 h-4"
                />
                <div>
                  <div class="font-medium">GLM-4-Plus</div>
                  <div class="text-xs text-gray-400">
                    效果更强，适合复杂问题
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- 执行按钮 -->
          <button
            @click="runEvaluation"
            :disabled="loading || questionCount === 0"
            class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="!loading">🚀 开始打分</span>
            <span v-else
              >⏳ 打分中... ({{ completedCount }}/{{ questionCount }})</span
            >
          </button>
        </div>

        <!-- 右侧：结果区 -->
        <div class="space-y-6">
          <!-- 统计卡片 -->
          <div v-if="results.length > 0" class="grid grid-cols-3 gap-4">
            <div class="bg-white rounded-lg shadow-sm p-4">
              <div class="text-xs text-gray-400">总耗时</div>
              <div class="text-xl font-bold text-gray-800">
                {{ totalDuration }}ms
              </div>
            </div>
            <div class="bg-white rounded-lg shadow-sm p-4">
              <div class="text-xs text-gray-400">平均耗时</div>
              <div class="text-xl font-bold text-gray-800">
                {{ avgDuration }}ms
              </div>
            </div>
            <div class="bg-white rounded-lg shadow-sm p-4">
              <div class="text-xs text-gray-400">Token 总数</div>
              <div class="text-xl font-bold text-gray-800">
                {{ totalTokens }}
              </div>
            </div>
          </div>

          <!-- 结果列表 -->
          <div class="bg-white rounded-lg shadow-sm overflow-hidden">
            <div class="border-b px-6 py-3 bg-gray-50">
              <h2 class="font-medium text-gray-700">📊 打分结果</h2>
            </div>

            <div
              v-if="results.length === 0 && !loading"
              class="p-12 text-center text-gray-400"
            >
              点击「开始打分」查看结果
            </div>

            <div
              v-if="loading && results.length === 0"
              class="p-12 text-center text-gray-400"
            >
              正在调用 AI 模型...
            </div>

            <div class="divide-y">
              <div
                v-for="(result, idx) in results"
                :key="idx"
                class="p-6 hover:bg-gray-50 transition-colors"
              >
                <div class="flex items-start gap-3">
                  <!-- 问题序号 -->
                  <div
                    class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0"
                  >
                    {{ idx + 1 }}
                  </div>

                  <div class="flex-1 space-y-3">
                    <!-- 问题 -->
                    <div class="font-medium text-gray-800">
                      {{ submittedQuestions[idx] || `追问 ${idx + 1}` }}
                    </div>

                    <!-- 答案 -->
                    <div
                      class="text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3"
                    >
                      {{ result.content || "暂无回答" }}
                    </div>

                    <!-- 元数据 -->
                    <div class="flex flex-wrap gap-4 text-xs text-gray-400">
                      <span>📊 Token: {{ result.totalTokens || 0 }}</span>
                      <span>⏱️ 耗时: {{ result.duration || 0 }}ms</span>
                      <span v-if="result.promptTokens"
                        >📥 输入: {{ result.promptTokens }}</span
                      >
                      <span v-if="result.completionTokens"
                        >📤 输出: {{ result.completionTokens }}</span
                      >
                    </div>
                    <!-- 在 pages/index.vue 的结果列表模板中，找到答案展示的位置 -->
                    <!-- 在 <div class="text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3"> 下面添加 -->

                    <!-- 评分展示 -->
                    <div
                      v-if="result.score"
                      class="mt-3 pt-3 border-t border-gray-200"
                    >
                      <div class="flex items-center gap-3 mb-2">
                        <span class="text-sm font-medium text-gray-700"
                          >综合评分：</span
                        >
                        <span
                          class="text-lg font-bold px-2 py-0.5 rounded"
                          :class="{
                            'bg-green-100 text-green-700': result.score >= 80,
                            'bg-yellow-100 text-yellow-700':
                              result.score >= 60 && result.score < 80,
                            'bg-red-100 text-red-700': result.score < 60,
                          }"
                        >
                          {{ result.score }} 分
                        </span>
                      </div>

                      <!-- 各维度评分 -->
                      <div
                        v-if="result.dimensions"
                        class="flex flex-wrap gap-3 mb-2 text-xs"
                      >
                        <div class="flex items-center gap-1">
                          <span class="text-gray-500">准确性:</span>
                          <span class="font-medium">{{
                            result.dimensions.accuracy
                          }}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-gray-500">完整性:</span>
                          <span class="font-medium">{{
                            result.dimensions.completeness
                          }}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-gray-500">相关性:</span>
                          <span class="font-medium">{{
                            result.dimensions.relevance
                          }}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-gray-500">清晰度:</span>
                          <span class="font-medium">{{
                            result.dimensions.clarity
                          }}</span>
                        </div>
                      </div>

                      <!-- 评分理由（可折叠） -->
                      <details v-if="result.reasoning" class="text-xs">
                        <summary
                          class="text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                          查看评分理由
                        </summary>
                        <p class="text-gray-500 mt-1 p-2 bg-gray-50 rounded">
                          {{ result.reasoning }}
                        </p>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 保存按钮 -->
          <div v-if="results.length > 0" class="flex gap-3">
            <button
              @click="saveEvaluation"
              class="flex-1 bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              💾 保存本次结果
            </button>
            <button
              @click="exportResults"
              class="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              📋 导出 JSON
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

interface EvaluationResultItem {
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
}

interface EvaluateResponse {
  id?: number;
  results?: EvaluationResultItem[];
}

const questionsText = ref(
  "什么是 Vue 3 的 Composition API？\n解释一下 JavaScript 的闭包\nReact 和 Vue 有什么区别？",
);
const submittedQuestions = ref<string[]>([]);
const selectedModel = ref("glm-4-flash");
const loading = ref(false);
const results = ref<EvaluationResultItem[]>([]);
const evaluationId = ref<number | null>(null);

// 计算属性
const questionCount = computed(() => {
  return questionsText.value.split("\n").filter((q) => q.trim()).length;
});

const completedCount = computed(() => results.value.length);

const totalDuration = computed(() => {
  return results.value.reduce((sum, r) => sum + (r.duration || 0), 0);
});

const avgDuration = computed(() => {
  if (results.value.length === 0) return 0;
  return Math.round(totalDuration.value / results.value.length);
});

const totalTokens = computed(() => {
  return results.value.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
});

// 执行评测
const runEvaluation = async () => {
  const questions = questionsText.value
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean);

  if (questions.length === 0) {
    alert("请至少输入一条追问");
    return;
  }

  loading.value = true;
  results.value = [];
  submittedQuestions.value = questions;
  evaluationId.value = null;

  try {
    const response = await $fetch<EvaluateResponse>("/api/evaluate", {
      method: "POST",
      body: {
        questions,
        model: selectedModel.value,
      },
    });

    results.value = response.results ?? [];
    evaluationId.value = response.id ?? null;
  } catch (error: any) {
    console.error("评测失败:", error);
    alert(`打分失败: ${error.data?.message || error.message}`);
    results.value = [];
  } finally {
    loading.value = false;
  }
};

// 保存评测
const saveEvaluation = async () => {
  if (!evaluationId.value) {
    alert("暂无可保存的结果");
    return;
  }

  try {
    await $fetch(`/api/evaluations/${evaluationId.value}/save`, {
      method: "POST",
      body: {
        name: `比言_${new Date().toLocaleString()}`,
      },
    });
    alert("保存成功！可以在历史记录中查看");
  } catch (error) {
    console.error("保存失败:", error);
    alert("保存失败");
  }
};

// 导出结果
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
onMounted(() => {
  const route = useRoute();
  const modelFromQuery = route.query.model;
  if (modelFromQuery === "glm-4-flash" || modelFromQuery === "glm-4-plus") {
    selectedModel.value = modelFromQuery;
  }

  const saved = sessionStorage.getItem("testQuestions");
  if (saved) {
    questionsText.value = saved;
    sessionStorage.removeItem("testQuestions");
  }
});
</script>
