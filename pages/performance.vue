<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 class="text-xl font-bold text-gray-800 sm:text-2xl">
              ⚡ 模型性能监控
            </h1>
            <p class="text-gray-500 text-sm mt-1">
              响应时间、成功率、Token 消耗趋势
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-sm sm:gap-4">
            <NuxtLink to="/stats" class="text-blue-500 hover:text-blue-600">
              💰 成本统计
            </NuxtLink>
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
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="i in 3" :key="`perf-summary-${i}`" class="bg-white rounded-lg p-4 shadow-sm">
            <Skeleton height="h-4" width="45%" />
            <div class="mt-3">
              <Skeleton height="h-8" width="55%" />
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm space-y-3">
          <Skeleton height="h-5" width="35%" />
          <Skeleton height="h-64" width="100%" />
        </div>
      </div>
      <n-spin :show="false">
        <n-empty v-if="loadError" :description="loadError" />
        <div v-if="performance">
          <!-- 汇总卡片 -->
          <n-grid
            cols="1 s:2 m:3"
            responsive="screen"
            :x-gap="12"
            :y-gap="12"
            class="mb-6 sm:mb-8"
          >
            <n-gi>
              <n-card :bordered="false" class="shadow-sm">
                <n-statistic
                  label="模型调用次数"
                  :value="performance.summary.totalRequests"
                >
                  <template #suffix>
                    <span class="text-sm text-gray-400">次调用</span>
                  </template>
                </n-statistic>
              </n-card>
            </n-gi>
            <n-gi>
              <n-card :bordered="false" class="shadow-sm">
                <n-statistic
                  label="平均响应时间"
                  :value="`${performance.summary.avgResponseTime}ms`"
                >
                  <template #suffix>
                    <span class="text-sm text-gray-400">毫秒</span>
                  </template>
                </n-statistic>
              </n-card>
            </n-gi>
            <n-gi>
              <n-card :bordered="false" class="shadow-sm">
                <n-statistic
                  label="整体成功率"
                  :value="`${performance.summary.overallSuccessRate}%`"
                >
                  <template #prefix>
                    <span class="text-green-500">✓</span>
                  </template>
                </n-statistic>
              </n-card>
            </n-gi>
          </n-grid>
          <div class="text-xs text-gray-400 -mt-3 mb-2">
            口径说明：性能监控中的“模型调用次数”按每条回答明细统计（每条问题调用算
            1 次）。
          </div>

          <!-- 响应时间趋势图 -->
          <n-card
            title="📈 响应时间趋势（近7天）"
            :bordered="false"
            class="shadow-sm mb-6 sm:mb-8"
          >
            <div
              v-if="performance.globalTrend.length === 0"
              class="text-center py-8 text-gray-400"
            >
              暂无数据
            </div>
            <div v-else class="h-64 sm:h-80">
              <div ref="trendChartRef" class="w-full h-full"></div>
            </div>
          </n-card>

          <!-- 各模型性能对比 -->
          <n-card title="🚀 各模型性能对比" :bordered="false" class="shadow-sm">
            <n-empty
              v-if="!performance.byModel || performance.byModel.length === 0"
              description="暂无性能数据，请先跑一轮评测"
            />
            <div v-else class="overflow-x-auto">
              <div class="min-w-[760px]">
                <n-data-table
                  :columns="columns"
                  :data="performance.byModel"
                  :bordered="true"
                  :striped="true"
                  size="small"
                />
              </div>
            </div>
          </n-card>
        </div>
        <n-empty v-else description="暂无性能数据" />
      </n-spin>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
  h,
} from "vue";
import * as echarts from "echarts";
import {
  NCard,
  NDataTable,
  NEmpty,
  NGi,
  NGrid,
  NSpin,
  NStatistic,
  NTag,
} from "naive-ui";
import type { DataTableColumns } from "naive-ui";

const loading = ref(true);
const performance = ref<any>(null);
const loadError = ref("");
const trendChartRef = ref<HTMLElement | null>(null);
let trendChart: echarts.ECharts | null = null;

// Naive UI 表格列配置
const columns: DataTableColumns<any> = [
  {
    title: "模型",
    key: "displayName",
    width: 150,
    render(row: any) {
      return h("div", { class: "font-medium" }, [
        row.displayName,
        row.avgDuration ===
        Math.min(
          ...(performance.value?.byModel.map((m: any) => m.avgDuration) || [0]),
        )
          ? h(
              NTag,
              { type: "success", size: "small", class: "ml-2" },
              { default: () => "最快" },
            )
          : null,
      ]);
    },
  },
  {
    title: "调用次数",
    key: "totalRequests",
    align: "right",
    width: 100,
  },
  {
    title: "成功率",
    key: "successRate",
    align: "right",
    width: 100,
    render(row: any) {
      const color =
        row.successRate >= 95
          ? "green"
          : row.successRate >= 80
            ? "yellow"
            : "red";
      return h(
        NTag,
        { type: color as any, size: "small" },
        { default: () => `${row.successRate}%` },
      );
    },
  },
  {
    title: "平均响应",
    key: "avgDuration",
    align: "right",
    width: 100,
    render(row: any) {
      return `${row.avgDuration}ms`;
    },
  },
  {
    title: "P95",
    key: "p95",
    align: "right",
    width: 80,
    render(row: any) {
      return `${row.p95}ms`;
    },
  },
  {
    title: "P99",
    key: "p99",
    align: "right",
    width: 80,
    render(row: any) {
      return `${row.p99}ms`;
    },
  },
  {
    title: "平均Token",
    key: "avgTokens",
    align: "right",
    width: 100,
  },
];

// ECharts 配置
const trendChartOption = computed(() => {
  if (!performance.value?.globalTrend) return {};

  const dates = performance.value.globalTrend.map((d: any) => d.date);
  const durations = performance.value.globalTrend.map(
    (d: any) => d.avgDuration,
  );

  return {
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: dates, name: "日期" },
    yAxis: { type: "value", name: "响应时间 (ms)" },
    series: [
      {
        name: "平均响应时间",
        type: "line",
        data: durations,
        smooth: true,
        areaStyle: { opacity: 0.3, color: "#3b82f6" },
        lineStyle: { color: "#3b82f6", width: 2 },
        itemStyle: { color: "#3b82f6" },
      },
    ],
  };
});

const renderTrendChart = async () => {
  await nextTick();
  if (!trendChartRef.value || !performance.value?.globalTrend?.length) return;

  if (trendChart) trendChart.dispose();
  trendChart = echarts.init(trendChartRef.value);
  trendChart.setOption(trendChartOption.value);
};

onMounted(async () => {
  try {
    performance.value = await $fetch("/api/stats/performance");
  } catch (error) {
    console.error("加载性能数据失败:", error);
    loadError.value = "加载性能数据失败，请稍后重试";
  } finally {
    loading.value = false;
  }

  await renderTrendChart();
});

watch(
  () => performance.value?.globalTrend,
  async () => {
    await renderTrendChart();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  if (trendChart) {
    trendChart.dispose();
    trendChart = null;
  }
});
</script>
