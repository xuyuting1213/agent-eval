<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 头部 -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 class="text-xl font-bold text-gray-800 sm:text-2xl">
              💰 成本统计
            </h1>
            <p class="text-gray-500 text-sm mt-1">
              Token 消耗与费用预估，基于已完成的评测记录
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-sm sm:gap-4">
            <NuxtLink to="/test-sets" class="text-blue-500 hover:text-blue-600">
              📋 用例
            </NuxtLink>
            <NuxtLink to="/" class="text-blue-500 hover:text-blue-600">
              ← 返回工作台
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <div v-if="loading" class="space-y-6">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="i in 4" :key="`stats-summary-${i}`" class="bg-white rounded-lg p-4 shadow-sm">
            <Skeleton height="h-4" width="45%" />
            <div class="mt-3">
              <Skeleton height="h-8" width="60%" />
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm space-y-3">
          <Skeleton height="h-5" width="25%" />
          <Skeleton height="h-48" width="100%" />
        </div>
      </div>
      <n-spin :show="false">
        <div v-if="viewStats" class="space-y-6">
          <n-grid cols="1 s:2 m:4" responsive="screen" :x-gap="16" :y-gap="16">
            <n-gi>
              <n-card size="small">
                <n-statistic
                  label="总费用"
                  :value="`$${viewStats.summary.totalCost.toFixed(4)}`"
                />
              </n-card>
            </n-gi>
            <n-gi>
              <n-card size="small">
                <n-statistic
                  label="评测批次数"
                  :value="viewStats.summary.totalRequests"
                />
              </n-card>
            </n-gi>
            <n-gi>
              <n-card size="small">
                <n-statistic
                  label="总 Token 消耗"
                  :value="formatNumber(viewStats.summary.totalTokens)"
                />
              </n-card>
            </n-gi>
            <n-gi>
              <n-card size="small">
                <n-statistic
                  label="单次平均费用"
                  :value="`$${viewStats.summary.avgCostPerRequest.toFixed(4)}`"
                />
              </n-card>
            </n-gi>
          </n-grid>
          <div class="text-xs text-gray-400 -mt-3">
            口径说明：成本统计中的“评测批次数”按每条 Evaluation
            记录统计（一次提交算一批）。
          </div>

          <n-card title="📊 按模型统计" size="small">
            <div class="overflow-x-auto">
              <div class="min-w-[680px]">
                <n-data-table
                  :columns="modelColumns"
                  :data="modelTableData"
                  :pagination="false"
                  size="small"
                />
              </div>
            </div>
          </n-card>

          <n-card title="📈 每日趋势" size="small">
            <div
              v-if="viewStats.dailyTrend.length === 0"
              class="text-center py-8 text-gray-400"
            >
              暂无数据
            </div>
            <div v-else class="h-64 sm:h-80">
              <ClientOnly>
                <v-chart :option="chartOption" autoresize />
              </ClientOnly>
            </div>
          </n-card>
        </div>
      </n-spin>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { NCard, NDataTable, NGi, NGrid, NSpin, NStatistic } from "naive-ui";
import type { DataTableColumns } from "naive-ui";

const loading = ref(true);
const stats = ref<any>(null);

const viewStats = computed(() => {
  if (!stats.value) return null;

  const byModel = Array.isArray(stats.value.byModel)
    ? stats.value.byModel.map((item: any) => ({
        model: item.model,
        displayName: item.displayName || item.model || "-",
        totalRequests: item.totalRequests ?? item.count ?? 0,
        totalTokens: item.totalTokens ?? 0,
        totalCost: item.totalCost ?? 0,
        avgCostPerRequest:
          item.avgCostPerRequest ??
          (item.totalCost ?? 0) /
            Math.max(item.totalRequests ?? item.count ?? 1, 1),
      }))
    : [];

  const totalCost =
    stats.value.summary?.totalCost ?? stats.value.totalCost ?? 0;
  const totalRequests =
    stats.value.summary?.totalRequests ?? stats.value.totalRequests ?? 0;
  const totalTokens =
    stats.value.summary?.totalTokens ??
    byModel.reduce(
      (sum: number, item: any) => sum + (item.totalTokens ?? 0),
      0,
    );
  const avgCostPerRequest =
    stats.value.summary?.avgCostPerRequest ??
    (totalRequests > 0 ? totalCost / totalRequests : 0);

  return {
    summary: {
      totalCost,
      totalRequests,
      totalTokens,
      avgCostPerRequest,
    },
    byModel,
    dailyTrend: Array.isArray(stats.value.dailyTrend)
      ? stats.value.dailyTrend
      : [],
  };
});

const formatNumber = (num: number) => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}w`;
  }
  return num.toLocaleString();
};

interface ModelRow {
  model: string;
  displayName: string;
  totalRequests: string;
  totalTokens: string;
  totalCost: string;
  avgCostPerRequest: string;
}

const modelColumns: DataTableColumns<ModelRow> = [
  { title: "模型", key: "displayName" },
  { title: "请求次数", key: "totalRequests" },
  { title: "Token 总数", key: "totalTokens" },
  { title: "总费用", key: "totalCost" },
  { title: "平均费用/次", key: "avgCostPerRequest" },
];

const modelTableData = computed<ModelRow[]>(() => {
  if (!viewStats.value) return [];
  return viewStats.value.byModel.map((model: any) => ({
    model: model.model,
    displayName: model.displayName,
    totalRequests: String(model.totalRequests),
    totalTokens: formatNumber(model.totalTokens),
    totalCost: `$${model.totalCost.toFixed(4)}`,
    avgCostPerRequest: `$${model.avgCostPerRequest.toFixed(4)}`,
  }));
});

// ECharts 配置
const chartOption = computed(() => {
  if (!viewStats.value?.dailyTrend) return {};

  const dates = viewStats.value.dailyTrend.map((d: any) => d.date);
  const costs = viewStats.value.dailyTrend.map((d: any) => d.cost);
  const requests = viewStats.value.dailyTrend.map((d: any) => d.requests);
  const tokens = viewStats.value.dailyTrend.map((d: any) =>
    Math.round(d.tokens / 1000),
  );

  return {
    tooltip: { trigger: "axis" },
    legend: { data: ["费用($)", "请求数", "Token(K)"] },
    xAxis: { type: "category", data: dates, name: "日期" },
    yAxis: [
      { type: "value", name: "费用($)", position: "left" },
      { type: "value", name: "请求数 / Token(K)", position: "right" },
    ],
    series: [
      {
        name: "费用($)",
        type: "line",
        data: costs,
        smooth: true,
        itemStyle: { color: "#10b981" },
        yAxisIndex: 0,
      },
      {
        name: "请求数",
        type: "bar",
        data: requests,
        itemStyle: { color: "#3b82f6" },
        yAxisIndex: 1,
      },
      {
        name: "Token(K)",
        type: "line",
        data: tokens,
        smooth: true,
        itemStyle: { color: "#f59e0b" },
        yAxisIndex: 1,
      },
    ],
  };
});

onMounted(async () => {
  try {
    stats.value = await $fetch("/api/stats/cost");
  } catch (error) {
    console.error("加载成本统计失败:", error);
  } finally {
    loading.value = false;
  }
});
</script>
