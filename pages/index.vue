<template>
  <EvaluateSkeleton v-if="initialLoading" />

  <div v-else class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <!-- 头部保持不变 -->
    <header
      class="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-md shadow-sm"
    >
      <!-- ... 头部内容不变 ... -->
    </header>

    <main class="mx-auto max-w-[1600px] px-6 py-6">
      <div class="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6">
        <!-- ========== 左侧配置面板 ========== -->
        <aside class="space-y-5">
          <!-- 🚀 运行控制卡片 - 移到最上面 -->
          <div
            class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 overflow-hidden sticky top-10"
          >
            <div class="px-5 py-3.5 border-b border-blue-200 bg-white/50">
              <h3 class="font-semibold text-blue-800">
                <span class="text-lg mr-1">⚡</span> 快速运行
              </h3>
            </div>
            <div class="p-5 space-y-4">
              <!-- 快捷操作栏 -->
              <div class="flex items-center justify-between gap-4 flex-wrap">
                <div
                  class="flex items-center gap-3 rounded-lg bg-white px-3 py-1.5 shadow-sm"
                >
                  <span class="text-xs text-slate-400">问题</span>
                  <span class="text-lg font-bold text-blue-600">{{
                    questionCount
                  }}</span>
                  <span class="text-slate-300">|</span>
                  <span class="text-xs text-slate-400">进度</span>
                  <span class="text-lg font-bold text-emerald-600">{{
                    completedCount
                  }}</span>
                  <span class="text-sm text-slate-400"
                    >/{{ questionCount }}</span
                  >
                </div>
                <div class="flex gap-2">
                  <button
                    @click="runEvaluation"
                    :disabled="loading || questionCount === 0"
                    class="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
                  >
                    <span v-if="!loading">▶ 开始评测</span>
                    <span v-else>⏳ 评测中</span>
                  </button>
                  <div class="flex items-center justify-between">
                    <div class="text-xs text-slate-500">联网搜索</div>
                    <n-switch v-model:value="enableTools" size="small" />
                  </div>
                  <button
                    v-if="loading"
                    @click="cancelEvaluation"
                    class="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-all"
                  >
                    🛑 中断
                  </button>
                </div>
              </div>

              <!-- 进度条 -->
              <div v-if="loading && questionCount > 0">
                <div class="flex justify-between text-xs text-slate-500 mb-1">
                  <span>评测进度</span>
                  <span
                    >{{
                      Math.round((completedCount / questionCount) * 100)
                    }}%</span
                  >
                </div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-blue-500 transition-all duration-300 rounded-full"
                    :style="{
                      width: `${(completedCount / questionCount) * 100}%`,
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 问题输入卡片 -->
          <div
            class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div
              class="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white"
            >
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-slate-700">
                  <span class="text-lg mr-1">📝</span> 问题集
                </h3>
                <NuxtLink
                  :to="{ path: '/test-sets', query: { model: selectedModel } }"
                  class="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                >
                  <span>📂</span> 从用例载入
                </NuxtLink>
              </div>
            </div>
            <div class="p-5">
              <textarea
                v-model="questionsText"
                rows="12"
                class="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none font-mono"
                placeholder="每行一个问题，例如：
什么是 Vue 3 的 Composition API？
解释一下 JavaScript 的闭包
React 和 Vue 有什么区别？"
              ></textarea>
              <div class="flex justify-between items-center mt-3">
                <div class="flex items-center gap-3 text-xs text-slate-400">
                  <span
                    >📋 共
                    <span class="font-semibold text-slate-600">{{
                      questionCount
                    }}</span>
                    条</span
                  >
                  <span v-if="completedCount > 0" class="text-emerald-600"
                    >✅ 已完成 {{ completedCount }}</span
                  >
                </div>
                <button
                  @click="clearQuestions"
                  class="text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  清空
                </button>
              </div>
            </div>
          </div>

          <!-- 模型选择卡片 -->
          <div
            class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div
              class="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white"
            >
              <h3 class="font-semibold text-slate-700">
                <span class="text-lg mr-1">🧠</span> 模型选型
              </h3>
            </div>
            <div class="p-4">
              <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                <div
                  v-for="model in modelOptions"
                  :key="model.value"
                  @click="selectedModel = model.value"
                  class="cursor-pointer rounded-lg border p-3 transition-all"
                  :class="[
                    selectedModel === model.value
                      ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-400'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  ]"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="text-sm font-medium text-slate-800">
                        {{ model.name }}
                      </div>
                      <div class="text-xs text-slate-400 mt-0.5">
                        {{ model.desc }}
                      </div>
                    </div>
                    <div
                      v-if="selectedModel === model.value"
                      class="text-blue-500 text-sm"
                    >
                      ✓
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- ========== 右侧结果面板（保持不变） ========== -->
        <section class="space-y-5">
          <!-- 统计概览卡片 -->
          <div v-if="results.length > 0" class="grid grid-cols-3 gap-4">
            <div
              class="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
            >
              <div class="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <span>⏱️</span> 总耗时
              </div>
              <div class="text-2xl font-bold text-slate-800">
                {{ totalDuration
                }}<span class="text-sm font-normal text-slate-400 ml-1"
                  >ms</span
                >
              </div>
            </div>
            <div
              class="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
            >
              <div class="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <span>⚡</span> 平均耗时
              </div>
              <div class="text-2xl font-bold text-slate-800">
                {{ avgDuration
                }}<span class="text-sm font-normal text-slate-400 ml-1"
                  >ms</span
                >
              </div>
            </div>
            <div
              class="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
            >
              <div class="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <span>📊</span> Token 总数
              </div>
              <div class="text-2xl font-bold text-slate-800">
                {{ totalTokens.toLocaleString() }}
              </div>
            </div>
          </div>

          <!-- 结果列表 -->
          <div
            class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div
              class="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center"
            >
              <h3 class="font-semibold text-slate-700">
                <span class="text-lg mr-1">📊</span> 评测结果
              </h3>
              <div class="flex gap-2">
                <button
                  v-if="results.length > 0"
                  @click="exportResults"
                  class="text-xs text-slate-500 hover:text-blue-500 px-2 py-1 rounded transition-colors"
                >
                  📥 导出 JSON
                </button>
                <button
                  v-if="results.length > 0"
                  @click="saveEvaluation"
                  class="text-xs text-emerald-500 hover:text-emerald-600 px-2 py-1 rounded transition-colors"
                >
                  💾 保存到历史
                </button>
              </div>
            </div>

            <div class="p-5">
              <EvaluateSkeleton v-if="loading && results.length === 0" />

              <div
                v-else-if="results.length === 0 && !loading"
                class="text-center py-12"
              >
                <div class="text-5xl mb-3">✨</div>
                <div class="text-slate-400">
                  左侧选择模型并输入问题，点击「开始评测」
                </div>
              </div>

              <div v-else class="space-y-4 max-h-[74vh] overflow-y-auto pr-2">
                <!-- 结果卡片内容不变 -->
                <div
                  v-for="(result, idx) in results"
                  :key="idx"
                  class="border rounded-xl overflow-hidden transition-all"
                  :class="{
                    'border-blue-300 shadow-md shadow-blue-100/50':
                      result.streamStatus === 'streaming',
                    'border-emerald-200': result.streamStatus === 'done',
                    'border-red-200': result.streamStatus === 'error',
                  }"
                >
                  <!-- 问题头 -->
                  <div
                    class="px-4 py-3 bg-slate-50 border-b flex items-center justify-between flex-wrap gap-2"
                  >
                    <div class="flex items-center gap-2">
                      <span
                        class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-medium flex items-center justify-center"
                        >{{ idx + 1 }}</span
                      >
                      <span
                        class="text-sm font-medium text-slate-700 break-words max-w-lg"
                        >{{
                          submittedQuestions[idx] || `问题 ${idx + 1}`
                        }}</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <span
                        v-if="result.streamStatus === 'streaming'"
                        class="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full"
                        >⏳ 生成中</span
                      >
                      <span
                        v-else-if="result.streamStatus === 'done'"
                        class="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"
                        >✅ 已完成</span
                      >
                      <span
                        v-else-if="result.streamStatus === 'error'"
                        class="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full"
                        >❌ 失败</span
                      >
                      <span
                        v-if="enableTools && result.streamStatus === 'done'"
                        class="text-xs px-2 py-0.5 rounded-full"
                        :class="{
                          'text-indigo-700 bg-indigo-100': result.toolSource === 'mcp',
                          'text-amber-700 bg-amber-100': result.toolSource === 'tavily',
                          'text-slate-600 bg-slate-100': !result.toolSource || result.toolSource === 'none',
                        }"
                      >
                        {{
                          result.toolSource === "mcp"
                            ? "🌐 MCP 已调用"
                            : result.toolSource === "tavily"
                              ? "🌐 降级 Tavily"
                              : "🌐 未调用 MCP"
                        }}
                      </span>
                      <span
                        v-if="result.score"
                        class="text-sm font-semibold"
                        :class="{
                          'text-emerald-600': result.score >= 80,
                          'text-amber-600':
                            result.score >= 60 && result.score < 80,
                          'text-red-500': result.score < 60,
                        }"
                        >{{ result.score }} 分</span
                      >
                    </div>
                  </div>

                  <!-- 回答内容 -->
                  <div class="p-4 bg-white">
                    <div class="text-xs text-slate-400 mb-2">回答内容</div>
                    <div
                      class="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
                    >
                      <div
                        v-if="
                          !result.content && result.streamStatus === 'streaming'
                        "
                        class="text-slate-400 flex items-center gap-2"
                      >
                        <span
                          class="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
                        ></span>
                        正在生成回答...
                      </div>
                      <div v-else>{{ result.content || "暂无回答" }}</div>
                    </div>
                  </div>

                  <!-- 元数据折叠区 -->
                  <details class="border-t bg-slate-50/50">
                    <summary
                      class="px-4 py-2 text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
                    >
                      查看详细指标
                    </summary>
                    <div class="px-4 pb-3 pt-1 flex flex-wrap gap-3">
                      <span class="text-xs bg-white px-2 py-1 rounded border"
                        >📊 Token: {{ result.totalTokens || 0 }}</span
                      >
                      <span class="text-xs bg-white px-2 py-1 rounded border"
                        >⏱️ 耗时: {{ result.duration || 0 }}ms</span
                      >
                      <span
                        v-if="result.promptTokens"
                        class="text-xs bg-white px-2 py-1 rounded border"
                        >📥 输入: {{ result.promptTokens }}</span
                      >
                      <span
                        v-if="result.completionTokens"
                        class="text-xs bg-white px-2 py-1 rounded border"
                        >📤 输出: {{ result.completionTokens }}</span
                      >
                    </div>
                  </details>

                  <!-- 评分详情 -->
                  <details v-if="result.dimensions" class="border-t">
                    <summary
                      class="px-4 py-2 text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
                    >
                      查看评分维度
                    </summary>
                    <div
                      class="px-4 pb-3 pt-1 grid grid-cols-4 gap-2 text-center"
                    >
                      <div class="bg-blue-50 rounded p-2">
                        <div class="text-xs text-slate-500">准确性</div>
                        <div class="text-sm font-semibold text-blue-600">
                          {{ result.dimensions.accuracy || 0 }}
                        </div>
                      </div>
                      <div class="bg-emerald-50 rounded p-2">
                        <div class="text-xs text-slate-500">完整性</div>
                        <div class="text-sm font-semibold text-emerald-600">
                          {{ result.dimensions.completeness || 0 }}
                        </div>
                      </div>
                      <div class="bg-amber-50 rounded p-2">
                        <div class="text-xs text-slate-500">相关性</div>
                        <div class="text-sm font-semibold text-amber-600">
                          {{ result.dimensions.relevance || 0 }}
                        </div>
                      </div>
                      <div class="bg-purple-50 rounded p-2">
                        <div class="text-xs text-slate-500">清晰度</div>
                        <div class="text-sm font-semibold text-purple-600">
                          {{ result.dimensions.clarity || 0 }}
                        </div>
                      </div>
                    </div>
                    <div v-if="result.reasoning" class="px-4 pb-3">
                      <div class="text-xs text-slate-400 mb-1">评分理由</div>
                      <div
                        class="text-xs text-slate-600 bg-slate-50 p-2 rounded"
                      >
                        {{ result.reasoning }}
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import EvaluateSkeleton from "~/components/skeletons/EvaluateSkeleton.vue";
import { modelOptions } from "~/composables/useModelOptions";
import { useEvaluateRunner } from "~/composables/useEvaluateRunner";
import {
  useMessage,
  NSwitch,
} from "naive-ui";
const enableTools = ref(false);
const message = useMessage();
const questionsText = ref(
  "近一周ai圈大事，帮我根据日期列出。\n五一上海天气如何？",
);
const selectedModel = ref("glm-4-flash");
const initialLoading = ref(true);

const {
  loading,
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
  message,
});

const scoreTagType = (score: number) => {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
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
