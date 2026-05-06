<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center gap-4">
          <button
            type="button"
            class="text-gray-500 hover:text-gray-700"
            @click="navigateTo(`/evaluation/${route.params.id}`)"
          >
            ← 返回详情
          </button>
          <h1 class="text-xl font-bold text-gray-800 sm:text-2xl">业务分析报告</h1>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6">
      <div v-if="loading" class="text-center py-12 text-gray-500">加载中…</div>

      <div v-else-if="report" class="space-y-6">
        <div
          v-if="!hasBusinessLayer"
          class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          当前记录缺少业务评分与 ROI（保存评测时请选择内置业务场景并重新跑批）。下方展示通用摘要。
        </div>

        <div class="rounded-lg p-6" :class="getDecisionClass(report.decision)">
          <div class="font-medium text-lg text-gray-900">决策摘要</div>
          <p class="text-sm text-gray-700 mt-2 leading-relaxed">{{ report.decision }}</p>
          <p class="text-xs text-gray-500 mt-2">基于业务得分与 ROI 估算，仅供参考。</p>
        </div>

        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-medium mb-4 text-gray-800">业务场景适配度</h2>
          <div class="flex flex-col sm:flex-row sm:items-center gap-6">
            <div class="text-center shrink-0">
              <div class="text-5xl font-bold" :class="getScoreClass(report.businessScore)">
                {{ Math.round(report.businessScore) }}
              </div>
              <div class="text-sm text-gray-500 mt-1">综合得分</div>
            </div>
            <div class="flex-1 text-sm text-gray-600 space-y-2">
              <div>
                <span class="font-medium text-gray-800">{{ report.scenario.name }}</span>
                — {{ report.scenario.description }}
              </div>
              <div v-if="report.scenario.successCriteria" class="text-gray-500">
                成功标准：{{ report.scenario.successCriteria }}
              </div>
            </div>
          </div>

          <div v-if="dimensionEntries.length" class="mt-6 space-y-3">
            <div
              v-for="[dimension, score] in dimensionEntries"
              :key="dimension"
              class="flex items-center gap-3"
            >
              <div class="w-28 text-sm text-gray-600 shrink-0">
                {{ getDimensionName(dimension) }}
              </div>
              <div class="flex-1 bg-gray-200 rounded-full h-2 min-w-0">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="getScoreBarClass(score)"
                  :style="{ width: `${Math.min(100, Math.max(0, score))}%` }"
                />
              </div>
              <div class="w-12 text-sm font-medium text-right">{{ Math.round(score) }}</div>
            </div>
          </div>
        </div>

        <div v-if="report.roi" class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-medium mb-4 text-gray-800">投资回报（估算）</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-green-600">
                {{ Number(report.roi.roi).toFixed(0) }}%
              </div>
              <div class="text-xs text-gray-500">ROI（净节省/模型日成本）</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-gray-800">
                ${{ Number(report.roi.totalModelCost).toFixed(4) }}
              </div>
              <div class="text-xs text-gray-500">本次评测模型成本</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-green-700">
                ${{ Number(report.roi.monthlySave).toFixed(0) }}
              </div>
              <div class="text-xs text-gray-500">月节省（人工）</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-violet-700">
                {{ Number(report.roi.paybackDays).toFixed(1) }}
              </div>
              <div class="text-xs text-gray-500">回本天数（粗算）</div>
            </div>
          </div>
          <p class="mt-4 text-sm text-gray-600">
            基于日均 {{ report.roi.dailyVolume }} 次、自动化率
            {{ (Number(report.roi.autoRate) * 100).toFixed(0) }}% 与本次 token 均摊估算；实际业务请按贵司数据校准。
          </p>
        </div>

        <div v-if="report.recommendations?.length" class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-medium mb-4 text-gray-800">改进建议</h2>
          <ul class="space-y-2">
            <li
              v-for="(rec, idx) in report.recommendations"
              :key="`rec-${idx}`"
              class="flex items-start gap-2 text-gray-600 text-sm"
            >
              <span class="text-blue-500 shrink-0">•</span>
              <span>{{ rec }}</span>
            </li>
          </ul>
        </div>

        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-medium mb-4 text-gray-800">逐题摘要</h2>
          <ul class="space-y-3 text-sm">
            <li
              v-for="(row, idx) in report.resultsSummary"
              :key="`sum-${idx}`"
              class="border border-gray-100 rounded-lg p-3"
            >
              <div class="font-medium text-gray-800">{{ row.question }}</div>
              <div class="text-gray-500 mt-1">
                技术分 {{ row.score ?? "—" }} · 业务分 {{ row.businessScore ?? "—" }}
              </div>
              <p class="text-gray-600 mt-2 line-clamp-3">{{ row.answerPreview }}</p>
            </li>
          </ul>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
            @click="exportReport"
          >
            导出 JSON
          </button>
        </div>
      </div>

      <div v-else class="text-center py-12 text-gray-400">未能加载报告</div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";

const route = useRoute();

interface RoiBlock {
  roi: number;
  totalModelCost: number;
  monthlySave: number;
  paybackDays: number;
  dailyVolume: number;
  autoRate: number;
}

interface BusinessReport {
  id: number;
  name: string;
  createdAt: string;
  scenario: {
    id: string;
    name: string;
    description: string;
    successCriteria: string;
  };
  businessScore: number;
  businessDimensions: Record<string, number>;
  roi: RoiBlock | null;
  resultsSummary: Array<{
    question: string;
    score: unknown;
    businessScore: unknown;
    answerPreview: string;
  }>;
  recommendations: string[];
  decision: string;
}

const loading = ref(true);
const report = ref<BusinessReport | null>(null);

const hasBusinessLayer = computed(() => {
  const r = report.value;
  if (!r) return false;
  if (r.roi) return true;
  return Object.keys(r.businessDimensions || {}).length > 0;
});

const dimensionEntries = computed(() =>
  Object.entries(report.value?.businessDimensions || {}).filter(
    (e): e is [string, number] => typeof e[1] === "number",
  ),
);

const getScoreClass = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
};

const getScoreBarClass = (score: number) => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
};

const getDecisionClass = (decision: string) => {
  if (decision.includes("强烈推荐") || decision.includes("推荐"))
    return "bg-green-50 border border-green-200";
  if (decision.includes("可考虑")) return "bg-yellow-50 border border-yellow-200";
  return "bg-red-50 border border-red-200";
};

const getDimensionName = (dimension: string) => {
  const names: Record<string, string> = {
    accuracy: "准确性",
    completeness: "完整性",
    relevance: "相关性",
    clarity: "清晰度",
    empathy: "共情力",
    compliance: "合规性",
    calculation: "计算准确",
  };
  return names[dimension] || dimension;
};

const loadReport = async () => {
  const id = route.params.id;
  loading.value = true;
  try {
    report.value = await $fetch<BusinessReport>(`/api/evaluations/${id}/business-report`);
  } catch {
    report.value = null;
  } finally {
    loading.value = false;
  }
};

const exportReport = () => {
  if (!report.value) return;
  const blob = new Blob([JSON.stringify(report.value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `business_report_${route.params.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

onMounted(() => {
  loadReport();
});
</script>
