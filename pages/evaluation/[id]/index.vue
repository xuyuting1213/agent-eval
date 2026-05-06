<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6">
        <div class="flex items-center gap-4">
          <button type="button" class="text-gray-500 hover:text-gray-700" @click="navigateTo('/history')">
            ← 返回
          </button>
          <h1 class="text-xl font-bold text-gray-800 sm:text-2xl">记录详情</h1>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <div v-if="loading" class="space-y-6">
        <div class="bg-white rounded-lg shadow-sm p-6">
          <Skeleton height="h-6" width="20%" />
          <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Skeleton height="h-12" width="100%" />
            <Skeleton height="h-12" width="100%" />
            <Skeleton height="h-12" width="100%" />
            <Skeleton height="h-12" width="100%" />
          </div>
        </div>
        <div class="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <Skeleton height="h-5" width="25%" />
          <div v-for="i in 3" :key="`detail-skeleton-${i}`" class="space-y-2">
            <Skeleton height="h-4" width="65%" />
            <Skeleton height="h-16" width="100%" />
          </div>
        </div>
      </div>

      <div v-else-if="evaluation" class="space-y-6">
        <!-- 概览卡片 -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <div class="flex flex-wrap justify-between gap-3 items-start mb-4">
            <h2 class="text-lg font-medium">📊 概览</h2>
            <NuxtLink
              :to="`/evaluation/${evaluation.id}/business-report`"
              class="inline-flex items-center rounded-lg bg-violet-600 text-white text-sm px-4 py-2 hover:bg-violet-700"
            >
              业务报告
            </NuxtLink>
          </div>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div class="text-xs text-gray-400">问题数量</div>
              <div class="text-xl font-bold">{{ metrics.totalQuestions }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">平均得分</div>
              <div class="text-xl font-bold" :class="getScoreClass(metrics.averageScore)">
                {{ metrics.averageScore?.toFixed(1) || "N/A" }}
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-400">平均耗时</div>
              <div class="text-xl font-bold">{{ metrics.averageDuration?.toFixed(0) || 0 }}ms</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">使用模型</div>
              <div class="text-xl font-bold text-sm">{{ metrics.model }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">业务场景</div>
              <div class="text-xl font-bold text-sm">{{ evaluation.scenario || metrics.scenario || "-" }}</div>
            </div>
          </div>
        </div>

        <!-- 结果列表 -->
        <div class="bg-white rounded-lg shadow-sm overflow-hidden">
          <div class="border-b px-6 py-3 bg-gray-50">
            <h2 class="font-medium text-gray-700">📝 详细结果</h2>
          </div>
          <div class="divide-y">
            <div v-for="(result, idx) in results" :key="idx" class="p-4 sm:p-6">
              <div class="flex items-start gap-3">
                <div
                  class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0"
                >
                  {{ idx + 1 }}
                </div>
                <div class="flex-1 space-y-3">
                  <div class="font-medium text-gray-800">
                    {{ result.question }}
                  </div>
                  <div class="text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">
                    {{ result.answer || result.content || "暂无回答" }}
                  </div>
                  <div v-if="result.score" class="mt-3 pt-3 border-t border-gray-200">
                    <div class="flex items-center gap-3 mb-2">
                      <span class="text-sm font-medium text-gray-700">综合评分：</span>
                      <span class="text-lg font-bold px-2 py-0.5 rounded" :class="getScoreClass(result.score)">
                        {{ result.score }} 分
                      </span>
                    </div>
                    <div class="flex flex-wrap gap-3 mb-2 text-xs">
                      <div>准确性: {{ result.dimensions?.accuracy }}</div>
                      <div>完整性: {{ result.dimensions?.completeness }}</div>
                      <div>相关性: {{ result.dimensions?.relevance }}</div>
                      <div>清晰度: {{ result.dimensions?.clarity }}</div>
                    </div>
                    <details class="text-xs">
                      <summary class="text-gray-400 cursor-pointer">查看评分理由</summary>
                      <p class="text-gray-500 mt-1 p-2 bg-gray-50 rounded">{{ result.reasoning }}</p>
                    </details>
                  </div>
                  <div class="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>📊 Token: {{ result.totalTokens || 0 }}</span>
                    <span>⏱️ 耗时: {{ result.duration || 0 }}ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
            @click="exportDetail"
          >
            📥 导出 JSON
          </button>
        </div>

        <div v-if="trajectory.length" class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-medium mb-4">🔄 执行轨迹</h2>
          <div class="space-y-3">
            <div
              v-for="(step, idx) in trajectory"
              :key="`trace-${idx}-${step.step || idx}`"
              class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                {{ step.step || idx + 1 }}
              </div>
              <div class="flex-1">
                <div class="font-medium text-sm">
                  {{
                    step.type === "tool_call"
                      ? "🔧 调用工具"
                      : step.type === "tool_result"
                        ? "📋 工具返回"
                        : "🧠 模型输出"
                  }}
                </div>
                <div v-if="step.type === 'tool_call'" class="text-sm text-gray-600 break-all">
                  工具：{{ step.toolCall?.name || step.toolName || "-" }}<br />
                  输入：{{ JSON.stringify(step.toolCall?.arguments ?? step.toolInput ?? "", null, 0) }}
                </div>
                <div v-else-if="step.type === 'tool_result'" class="text-sm text-gray-600 break-words">
                  结果：{{ stringifyPreview(step.toolResult) }}
                </div>
                <div v-else class="text-sm text-gray-600 break-words">
                  输出：{{ stringifyPreview(step.llmOutput) }}
                </div>
                <div class="text-xs text-gray-400 mt-1">
                  {{ (Number(step.timestamp || 0) / 1000).toFixed(1) }}秒
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12 text-gray-400">未找到这条记录</div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const route = useRoute();
interface EvaluationDetailResponse {
  id: number;
  createdAt: string;
  results: any[];
  metrics: Record<string, any>;
  trajectory?: any[];
  scenario?: string | null;
}
const evaluation = ref<any>(null);
const results = ref<any[]>([]);
const metrics = ref<any>({});
const trajectory = ref<any[]>([]);
const loading = ref(true);

const getScoreClass = (score: number) => {
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

const loadEvaluation = async () => {
  const id = route.params.id;
  try {
    const data = await $fetch<EvaluationDetailResponse>(`/api/evaluations/${id}`);
    evaluation.value = data;
    results.value = data.results || [];
    metrics.value = data.metrics || {};
    trajectory.value = Array.isArray(data.trajectory) ? data.trajectory : [];
  } catch (error) {
    console.error("加载详情失败:", error);
  } finally {
    loading.value = false;
  }
};

const stringifyPreview = (raw: unknown) => {
  if (typeof raw === "string") return raw.slice(0, 240);
  try {
    return JSON.stringify(raw).slice(0, 240);
  } catch {
    return String(raw ?? "");
  }
};

const exportDetail = () => {
  const data = {
    id: evaluation.value.id,
    createdAt: evaluation.value.createdAt,
    metrics: metrics.value,
    results: results.value,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `evaluation_${evaluation.value.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

onMounted(() => {
  loadEvaluation();
});
</script>
