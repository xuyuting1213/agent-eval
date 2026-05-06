<template>
  <div class="min-h-screen bg-slate-50">
    <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-8">
      <header>
        <h1 class="text-2xl font-bold text-slate-800">Benchmark 任务套件</h1>
        <p class="text-slate-500 text-sm mt-1">
          任务若配置了 expectedTools，将走与工作台一致的<strong>带工具</strong>管线（联网 / 实况天气 /
          可选知识库）；否则为直连模型。跑批较慢时请耐心等待。
        </p>
      </header>

      <!-- 全局跑批选项 -->
      <section
        class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap gap-4 items-end"
      >
        <div>
          <label class="block text-xs text-slate-500 mb-1">业务场景</label>
          <select
            v-model="selectedScenario"
            class="rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[180px]"
          >
            <option v-for="s in scenarios" :key="s.id" :value="s.id">
              {{ s.icon }} {{ s.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-slate-500 mb-1">知识库（RAG，可选）</label>
          <select
            v-model="selectedKnowledgeBase"
            class="rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[200px]"
          >
            <option value="">不使用</option>
            <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
              {{ kb.name }}
            </option>
          </select>
        </div>
      </section>

      <!-- 按模型对比 -->
      <section
        v-if="modelComparison.length"
        class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm"
      >
        <h2 class="text-lg font-semibold text-slate-800 mb-4">结果对比（近期运行）</h2>
        <p class="text-xs text-slate-400 mb-3">按平均分与成功率汇总最近 {{ recentRuns.length }} 条记录</p>
        <div class="space-y-3">
          <div
            v-for="row in modelComparison"
            :key="row.model"
            class="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr] gap-2 items-center text-sm"
          >
            <div class="font-medium text-slate-700 truncate">{{ row.model }}</div>
            <div>
              <div class="flex justify-between text-xs text-slate-500 mb-0.5">
                <span>平均分</span>
                <span>{{ row.avgScore.toFixed(1) }}</span>
              </div>
              <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-blue-500 transition-all"
                  :style="{ width: `${Math.min(100, row.avgScore)}%` }"
                ></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-xs text-slate-500 mb-0.5">
                <span>成功率</span>
                <span>{{ (row.successRate * 100).toFixed(0) }}%</span>
              </div>
              <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-emerald-500 transition-all"
                  :style="{ width: `${Math.min(100, row.successRate * 100)}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 套件卡片 -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          v-for="suite in suites"
          :key="suite.id"
          class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3"
        >
          <div class="flex justify-between gap-3 flex-wrap">
            <div>
              <h3 class="font-semibold text-slate-800">{{ suite.name }}</h3>
              <p class="text-slate-500 text-sm mt-0.5">
                {{ suite.description || "—" }}
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  {{ taskCount(suite) }} 个任务
                </span>
                <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  {{ suite.category }}
                </span>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <select
                v-model="selectedModel"
                class="rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[160px]"
              >
                <option v-for="m in modelOptions" :key="m.value" :value="m.value">
                  {{ m.name }}
                </option>
              </select>
              <button
                type="button"
                :disabled="runningSuiteId !== null || adversarialRunning"
                class="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-emerald-700"
                @click="runSuite(suite.id)"
              >
                {{ runningSuiteId === suite.id ? "运行中…" : "运行" }}
              </button>
            </div>
          </div>
          <div
            v-if="lastRuns[suite.id]"
            class="pt-3 border-t border-slate-100 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1"
          >
            <span>上次：{{ formatDate(lastRuns[suite.id].createdAt) }}</span>
            <span class="text-emerald-600">
              成功率
              {{ (Number(lastRuns[suite.id].summary?.successRate || 0) * 100).toFixed(0) }}%
            </span>
            <span>均分 {{ Number(lastRuns[suite.id].summary?.avgScore || 0).toFixed(1) }}</span>
          </div>
        </div>
      </section>

      <!-- 独立对抗测试（规则 + 边界评分） -->
      <section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div>
          <h2 class="text-lg font-semibold text-slate-800">对抗测试</h2>
          <p class="text-slate-500 text-sm mt-1">
            越狱 / 信息泄露 / 模糊输入 / 无意义输入 / 边界场景；直连模型后按规则与评分判定。与套件「{{
              adversarialPack?.name || "鲁棒性对抗测试"
            }}」任务一致，亦可上表跑批用 LLM 评分对比。
          </p>
        </div>
        <div class="flex flex-wrap gap-3 items-end">
          <div>
            <label class="block text-xs text-slate-500 mb-1">模型</label>
            <select
              v-model="adversarialModel"
              class="rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[180px]"
            >
              <option v-for="m in modelOptions" :key="m.value" :value="m.value">
                {{ m.name }}
              </option>
            </select>
          </div>
          <button
            type="button"
            :disabled="adversarialRunning || runningSuiteId !== null"
            class="px-4 py-1.5 rounded-lg bg-orange-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-orange-700"
            @click="runAdversarial"
          >
            {{ adversarialRunning ? "运行中…" : "运行对抗测试" }}
          </button>
        </div>
        <div v-if="adversarialHistory.length" class="pt-4 border-t border-slate-100">
          <h3 class="text-sm font-medium text-slate-700 mb-2">最近记录</h3>
          <div class="space-y-2">
            <div
              v-for="h in adversarialHistory.slice(0, 8)"
              :key="h.id"
              class="flex flex-wrap justify-between gap-2 text-sm border border-slate-100 rounded-lg px-3 py-2"
            >
              <div>
                <span class="font-mono text-slate-800">{{ h.model }}</span>
                <span class="text-slate-400 text-xs ml-2">{{ formatDate(h.createdAt) }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-emerald-600 text-xs">
                  通过率 {{ ((Number(h.summary?.successRate) || 0) * 100).toFixed(0) }}%
                </span>
                <button
                  type="button"
                  class="text-blue-600 text-xs hover:underline"
                  @click="openAdversarialHistoryDetail(h.id)"
                >
                  查看
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 历史 -->
      <section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-800 mb-3">运行历史</h2>
        <div v-if="!recentRuns.length" class="text-center text-slate-400 py-8 text-sm">
          暂无运行记录
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="run in recentRuns"
            :key="run.id"
            class="border border-slate-100 rounded-lg p-3 flex flex-wrap justify-between gap-2 text-sm"
          >
            <div>
              <span class="font-medium text-slate-800">{{ run.suite?.name || run.suiteId }}</span>
              <span class="text-slate-500 ml-2">{{ run.model }}</span>
            </div>
            <div class="text-slate-600">
              成功率 {{ (Number(run.summary?.successRate || 0) * 100).toFixed(0) }}% · 均分
              {{ Number(run.summary?.avgScore || 0).toFixed(1) }}
            </div>
            <button
              type="button"
              class="text-blue-600 text-xs hover:underline"
              @click="openRun(run)"
            >
              查看
            </button>
            <div class="w-full text-xs text-slate-400">{{ formatDate(run.createdAt) }}</div>
          </div>
        </div>
      </section>
    </main>

    <Teleport to="body">
      <div
        v-if="showResults && currentRun"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="showResults = false"
      >
        <div
          class="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
        >
          <div class="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
            <h3 class="font-semibold text-slate-800">运行结果</h3>
            <button type="button" class="text-slate-400 hover:text-slate-700" @click="showResults = false">
              ✕
            </button>
          </div>
          <div class="p-5 overflow-y-auto flex-1 space-y-4">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
              <div class="bg-slate-50 rounded-lg p-3">
                <div class="text-xl font-bold text-slate-800">
                  {{ currentRun.summary?.totalTasks ?? "—" }}
                </div>
                <div class="text-slate-500 text-xs">任务数</div>
              </div>
              <div class="bg-emerald-50 rounded-lg p-3">
                <div class="text-xl font-bold text-emerald-700">
                  {{ ((currentRun.summary?.successRate || 0) * 100).toFixed(0) }}%
                </div>
                <div class="text-slate-500 text-xs">成功率</div>
              </div>
              <div class="bg-blue-50 rounded-lg p-3">
                <div class="text-xl font-bold text-blue-700">
                  {{ Number(currentRun.summary?.avgScore || 0).toFixed(1) }}
                </div>
                <div class="text-slate-500 text-xs">平均分</div>
              </div>
              <div class="bg-violet-50 rounded-lg p-3">
                <div class="text-xl font-bold text-violet-700">
                  {{ Math.round(Number(currentRun.summary?.avgDuration || 0)) }}
                </div>
                <div class="text-slate-500 text-xs">均耗时 ms</div>
              </div>
            </div>
            <div class="space-y-2">
              <h4 class="font-medium text-slate-700 text-sm">任务明细</h4>
              <div
                v-for="task in normalizedTaskResults(currentRun)"
                :key="task.taskId"
                class="border border-slate-100 rounded-lg p-3 text-sm"
              >
                <div class="flex justify-between gap-2 flex-wrap">
                  <span class="font-medium">{{ task.taskName }}</span>
                  <span :class="task.success ? 'text-emerald-600' : 'text-red-600'">
                    {{ task.success ? "通过" : "未通过" }} · {{ task.score?.toFixed?.(0) ?? task.score }} 分
                  </span>
                </div>
                <div
                  v-if="task.runMode || (task.toolCalls && task.toolCalls.length)"
                  class="flex flex-wrap gap-1 mt-1"
                >
                  <span
                    v-if="task.runMode"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                    >{{ task.runMode === "tools" ? "带工具" : "直连" }}</span
                  >
                  <span
                    v-for="t in task.toolCalls || []"
                    :key="t"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700"
                    >{{ t }}</span
                  >
                  <span
                    v-if="task.hasKnowledgeHit"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700"
                    >知识库命中</span
                  >
                </div>
                <p class="text-xs text-slate-500 mt-1 line-clamp-2">{{ task.input }}</p>
                <p class="text-slate-600 mt-2 whitespace-pre-wrap break-words text-xs max-h-32 overflow-y-auto">
                  {{ truncate(task.output, 400) }}
                </p>
                <p v-if="task.error" class="text-red-600 text-xs mt-1">{{ task.error }}</p>
              </div>
            </div>
          </div>
          <div class="px-5 py-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm"
              @click="showResults = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showAdversarialResults && adversarialPayload"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="showAdversarialResults = false"
      >
        <div
          class="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <div class="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
            <h3 class="font-semibold text-slate-800">对抗测试结果</h3>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-700"
              @click="showAdversarialResults = false"
            >
              ✕
            </button>
          </div>
          <div class="p-5 overflow-y-auto flex-1 space-y-5">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
              <div class="bg-slate-50 rounded-lg p-3">
                <div class="text-xl font-bold text-slate-800">
                  {{ adversarialPayload.summary?.totalTasks ?? "—" }}
                </div>
                <div class="text-slate-500 text-xs">任务数</div>
              </div>
              <div class="bg-emerald-50 rounded-lg p-3">
                <div class="text-xl font-bold text-emerald-700">
                  {{ ((adversarialPayload.summary?.successRate || 0) * 100).toFixed(0) }}%
                </div>
                <div class="text-slate-500 text-xs">通过率</div>
              </div>
              <div class="bg-amber-50 rounded-lg p-3">
                <div class="text-xl font-bold text-amber-800">
                  {{ Number(adversarialPayload.summary?.avgScore || 0).toFixed(0) }}
                </div>
                <div class="text-slate-500 text-xs">平均分</div>
              </div>
              <div class="bg-violet-50 rounded-lg p-3">
                <div class="text-xl font-bold text-violet-700">
                  {{ Math.round(Number(adversarialPayload.summary?.avgDuration || 0)) }}
                </div>
                <div class="text-slate-500 text-xs">均耗时 ms</div>
              </div>
            </div>
            <div v-if="adversarialPayload.byCategory" class="space-y-2">
              <h4 class="font-medium text-slate-700 text-sm">按分类</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div
                  v-for="(stats, cat) in adversarialPayload.byCategory"
                  :key="String(cat)"
                  class="border border-slate-100 rounded-lg p-3 text-sm"
                >
                  <div class="font-medium text-slate-800">{{ getAdversarialCategoryName(String(cat)) }}</div>
                  <div
                    class="text-lg font-bold mt-1"
                    :class="stats.successRate >= 0.8 ? 'text-emerald-600' : 'text-red-600'"
                  >
                    {{ (stats.successRate * 100).toFixed(0) }}%
                  </div>
                  <div class="text-xs text-slate-400">{{ stats.success }}/{{ stats.total }}</div>
                </div>
              </div>
            </div>
            <div class="space-y-2">
              <h4 class="font-medium text-slate-700 text-sm">任务明细</h4>
              <div
                v-for="task in adversarialPayload.results"
                :key="task.taskId"
                class="border border-slate-100 rounded-lg p-3 text-sm space-y-2"
              >
                <div class="flex flex-wrap justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-slate-800">{{ task.taskName }}</span>
                    <span
                      class="text-[10px] px-2 py-0.5 rounded"
                      :class="adversarialCategoryBadgeClass(task.category)"
                    >
                      {{ getAdversarialCategoryName(task.category) }}
                    </span>
                  </div>
                  <span class="text-xs text-slate-400">{{ task.duration }} ms</span>
                </div>
                <p class="text-xs text-slate-500 whitespace-pre-wrap break-words">{{ task.input }}</p>
                <p class="text-slate-600 text-xs whitespace-pre-wrap break-words max-h-28 overflow-y-auto">
                  {{ truncate(task.output, 400) }}
                </p>
                <p v-if="task.error" class="text-red-600 text-xs">{{ task.error }}</p>
                <div v-if="task.evaluation" class="text-xs">
                  <span :class="task.evaluation.success ? 'text-emerald-600' : 'text-red-600'">
                    {{ task.evaluation.success ? "✓ 通过" : "✗ 未通过" }}
                  </span>
                  <span class="text-slate-500 ml-2">{{ task.evaluation.reason }}</span>
                  <span class="text-slate-400 ml-2">· {{ task.evaluation.score }} 分</span>
                </div>
              </div>
            </div>
          </div>
          <div class="px-5 py-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm"
              @click="showAdversarialResults = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui";
import { modelOptions } from "~/composables/useModelOptions";

interface BenchmarkSuite {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tasks: unknown;
}

interface RunSummary {
  totalTasks?: number;
  successRate?: number;
  avgScore?: number;
  avgDuration?: number;
}

interface BenchmarkRunRow {
  id: string;
  suiteId: string;
  model: string;
  results: unknown;
  summary: RunSummary | null;
  createdAt: string;
  suite?: { id: string; name: string; category: string };
}

interface ModelComparisonRow {
  model: string;
  runs: number;
  avgScore: number;
  successRate: number;
}

interface AdversarialSummary {
  totalTasks?: number;
  successRate?: number;
  avgScore?: number;
  avgDuration?: number;
}

interface AdversarialByCategoryStat {
  total: number;
  success: number;
  successRate: number;
}

interface AdversarialTaskRow {
  taskId: string;
  taskName: string;
  category: string;
  input: string;
  output?: string;
  duration: number;
  evaluation?: { success: boolean; score: number; reason: string };
  error?: string;
}

interface AdversarialPayload {
  model: string;
  summary: AdversarialSummary;
  byCategory: Record<string, AdversarialByCategoryStat>;
  results: AdversarialTaskRow[];
  ranAt?: string;
}

interface AdversarialHistoryRow {
  id: string;
  model: string;
  summary?: AdversarialSummary | null;
  createdAt: string;
}

const message = useMessage();
const suites = ref<BenchmarkSuite[]>([]);
const recentRuns = ref<BenchmarkRunRow[]>([]);
const modelComparison = ref<ModelComparisonRow[]>([]);
const adversarialPack = ref<{ name: string; description: string } | null>(null);
const scenarios = ref<Array<{ id: string; name: string; icon?: string }>>([
  { id: "customerService", name: "客服", icon: "🏢" },
  { id: "documentAnalysis", name: "文档", icon: "📄" },
  { id: "dataAssistant", name: "数据助手", icon: "📊" },
]);
const knowledgeBases = ref<Array<{ id: string; name: string }>>([]);
const selectedScenario = ref("customerService");
const selectedKnowledgeBase = ref("");
const selectedModel = ref(modelOptions[0]?.value || "glm-4-flash");
/** 当前正在跑批的套件 id；其它卡片仅禁用、文案仍为「运行」。 */
const runningSuiteId = ref<string | null>(null);
const adversarialModel = ref(modelOptions[0]?.value || "glm-4-flash");
const adversarialRunning = ref(false);
const adversarialHistory = ref<AdversarialHistoryRow[]>([]);
const adversarialPayload = ref<AdversarialPayload | null>(null);
const showAdversarialResults = ref(false);
const showResults = ref(false);
const currentRun = ref<BenchmarkRunRow | null>(null);

/** 从套件 JSON 取任务条数。 */
const taskCount = (suite: BenchmarkSuite) => {
  const t = suite.tasks;
  return Array.isArray(t) ? t.length : 0;
};

/** 将运行结果列表规范为可渲染结构。 */
const normalizedTaskResults = (run: BenchmarkRunRow) => {
  const r = run.results;
  if (!Array.isArray(r)) return [];
  return r as Array<{
    taskId: string;
    taskName: string;
    input: string;
    output?: string;
    success: boolean;
    score: number;
    error?: string;
    runMode?: "chat" | "tools";
    toolCalls?: string[];
    hasKnowledgeHit?: boolean;
  }>;
};

const truncate = (s: string | undefined, n: number) => {
  if (!s) return "";
  return s.length <= n ? s : `${s.slice(0, n)}…`;
};

const formatDate = (d: string) => new Date(d).toLocaleString();

/** 对抗任务分类中文名（供统计与标签展示）。 */
const getAdversarialCategoryName = (category: string) => {
  const names: Record<string, string> = {
    jailbreak: "越狱",
    infoLeak: "信息泄露",
    ambiguous: "模糊问题",
    nonsense: "无意义输入",
    edgeCase: "边界",
  };
  return names[category] || category;
};

/** 对抗分类标签配色。 */
const adversarialCategoryBadgeClass = (category: string) => {
  const map: Record<string, string> = {
    jailbreak: "bg-purple-100 text-purple-700",
    infoLeak: "bg-blue-100 text-blue-700",
    ambiguous: "bg-amber-100 text-amber-800",
    nonsense: "bg-slate-100 text-slate-600",
    edgeCase: "bg-red-100 text-red-700",
  };
  return map[category] || "bg-slate-100 text-slate-600";
};

const lastRuns = computed(() => {
  const m: Record<string, BenchmarkRunRow> = {};
  for (const run of recentRuns.value) {
    const sid = run.suiteId;
    if (!m[sid] || new Date(run.createdAt) > new Date(m[sid].createdAt)) {
      m[sid] = run;
    }
  }
  return m;
});

/** 拉取套件、历史与对比聚合。 */
const loadData = async () => {
  const data = await $fetch<{
    suites: BenchmarkSuite[];
    recentRuns: BenchmarkRunRow[];
    modelComparison: ModelComparisonRow[];
    adversarialPack: { name: string; description: string };
  }>("/api/benchmark");
  suites.value = data.suites || [];
  recentRuns.value = data.recentRuns || [];
  modelComparison.value = data.modelComparison || [];
  adversarialPack.value = data.adversarialPack || null;
};

/** 拉取业务场景与知识库（失败时静默为空）。 */
const loadBenchOptions = async () => {
  try {
    const rows = await $fetch<Array<{ id: string; name: string; icon?: string }>>(
      "/api/business/scenarios",
    );
    if (Array.isArray(rows) && rows.length) scenarios.value = rows;
  } catch {
    /* 使用默认三项 */
  }
  try {
    const kbs = await $fetch<Array<{ id: string; name: string }>>("/api/knowledge-base");
    knowledgeBases.value = Array.isArray(kbs) ? kbs : [];
  } catch {
    knowledgeBases.value = [];
  }
};

/** 跑指定套件并在弹窗中展示返回记录。 */
const runSuite = async (suiteId: string) => {
  runningSuiteId.value = suiteId;
  try {
    const result = await $fetch<BenchmarkRunRow>("/api/benchmark/run", {
      method: "POST",
      body: {
        suiteId,
        model: selectedModel.value,
        scenario: selectedScenario.value,
        knowledgeBaseId: selectedKnowledgeBase.value || null,
      },
    });
    currentRun.value = result;
    showResults.value = true;
    message.success("运行完成");
    await loadData();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "运行失败";
    message.error(msg);
  } finally {
    runningSuiteId.value = null;
  }
};

const openRun = (run: BenchmarkRunRow) => {
  currentRun.value = run;
  showResults.value = true;
};

/** 拉取对抗测试历史摘要。 */
const loadAdversarialHistory = async () => {
  try {
    const rows = await $fetch<AdversarialHistoryRow[]>("/api/benchmark/adversarial/history");
    adversarialHistory.value = Array.isArray(rows) ? rows : [];
  } catch {
    adversarialHistory.value = [];
  }
};

/** 执行独立对抗套件并打开结果弹窗。 */
const runAdversarial = async () => {
  adversarialRunning.value = true;
  try {
    const result = await $fetch<AdversarialPayload>("/api/benchmark/adversarial", {
      method: "POST",
      body: { model: adversarialModel.value },
    });
    adversarialPayload.value = result;
    showAdversarialResults.value = true;
    message.success("对抗测试完成");
    await loadAdversarialHistory();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "对抗测试失败";
    message.error(msg);
  } finally {
    adversarialRunning.value = false;
  }
};

/** 从历史 id 加载完整对抗记录并展示。 */
const openAdversarialHistoryDetail = async (id: string) => {
  try {
    const row = await $fetch<AdversarialPayload & { id: string; createdAt: string }>(
      `/api/benchmark/adversarial/${id}`,
    );
    adversarialPayload.value = {
      model: row.model,
      summary: row.summary as AdversarialSummary,
      byCategory: row.byCategory as Record<string, AdversarialByCategoryStat>,
      results: row.results as AdversarialTaskRow[],
      ranAt: row.createdAt,
    };
    showAdversarialResults.value = true;
  } catch {
    message.error("加载详情失败");
  }
};

onMounted(() => {
  loadBenchOptions();
  loadData().catch(() => message.error("加载失败"));
  loadAdversarialHistory();
});
</script>
