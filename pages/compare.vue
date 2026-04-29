<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 头部 -->
    <header class="sticky top-0 z-10 border-b bg-white shadow-sm">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 class="text-xl font-bold text-gray-800 sm:text-2xl">横评</h1>
            <p class="text-gray-500 text-sm mt-1">
              同一批题目，并排看清各家回答与得分，便于拍板选型
            </p>
          </div>
          <button
            @click="$router.back()"
            class="text-gray-500 hover:text-gray-700"
          >
            返回 ←
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <!-- 配置区 -->
      <div class="mb-8 rounded-lg bg-white p-4 shadow-sm sm:p-6">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <!-- 左侧：问题输入 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                📝 问题
              </label>
              <button
                @click="loadFromTestSet"
                class="text-xs text-blue-500 hover:text-blue-600"
              >
                从用例载入
              </button>
            </div>
            <textarea
              v-model="questionsText"
              rows="8"
              class="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="每行一条问题（将同时发给各模型），例如：
什么是 Vue 3 的 Composition API？
解释一下 JavaScript 的闭包
React 和 Vue 有什么区别？
什么是 TailwindCSS？
TypeScript 的好处是什么？"
            />
            <div class="flex justify-between mt-2">
              <div class="text-xs text-gray-400">
                共 {{ questionsCount }} 条问题
              </div>
              <button
                @click="clearQuestions"
                class="text-xs text-red-400 hover:text-red-500"
                v-if="questionsText"
              >
                清空
              </button>
            </div>
          </div>

          <!-- 右侧：模型选择 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                🧠 选择参与横评的模型
              </label>
              <div class="flex gap-2">
                <button
                  @click="selectAllModels"
                  class="text-xs text-blue-500 hover:text-blue-600"
                >
                  全选
                </button>
                <button
                  @click="deselectAllModels"
                  class="text-xs text-gray-500 hover:text-gray-600"
                >
                  清空
                </button>
              </div>
            </div>

            <div
              class="max-h-[320px] space-y-4 overflow-y-auto pr-1 sm:max-h-[400px] sm:pr-2"
            >
              <!-- 智谱 AI 系列 -->
              <div>
                <div
                  class="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2"
                >
                  <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                  智谱 AI (Zhipu) - 已配置
                </div>
                <div class="space-y-2">
                  <label
                    v-for="model in zhipuModels"
                    :key="model.value"
                    class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    :class="{
                      'border-blue-400 bg-blue-50': selectedModels.includes(
                        model.value,
                      ),
                    }"
                  >
                    <input
                      type="checkbox"
                      :value="model.value"
                      v-model="selectedModels"
                      class="w-4 h-4 mt-0.5"
                    />
                    <div class="flex-1">
                      <div class="font-medium text-gray-800">
                        {{ model.name }}
                      </div>
                      <div class="text-xs text-gray-400 mt-0.5">
                        {{ model.desc }}
                      </div>
                      <div class="text-xs text-gray-300 mt-1">
                        💰 输入: ${{ model.costPer1KInput }}/1K | 输出: ${{
                          model.costPer1KOutput
                        }}/1K
                      </div>
                    </div>
                    <div
                      class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                    >
                      ✓ 可用
                    </div>
                  </label>
                </div>
              </div>

              <!-- OpenAI 系列 -->
              <div>
                <div
                  class="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2"
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    :class="
                      configStatus.openai ? 'bg-green-500' : 'bg-gray-400'
                    "
                  ></span>
                  OpenAI
                  <span class="text-gray-300 text-xs">(需配置 API Key)</span>
                </div>
                <div class="space-y-2">
                  <label
                    v-for="model in openaiModels"
                    :key="model.value"
                    class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    :class="{
                      'opacity-60': !configStatus.openai,
                      'border-blue-400 bg-blue-50': selectedModels.includes(
                        model.value,
                      ),
                    }"
                  >
                    <input
                      type="checkbox"
                      :value="model.value"
                      v-model="selectedModels"
                      class="w-4 h-4 mt-0.5"
                      :disabled="!configStatus.openai"
                    />
                    <div class="flex-1">
                      <div class="font-medium text-gray-800">
                        {{ model.name }}
                      </div>
                      <div class="text-xs text-gray-400 mt-0.5">
                        {{ model.desc }}
                      </div>
                      <div class="text-xs text-gray-300 mt-1">
                        💰 输入: ${{ model.costPer1KInput }}/1K | 输出: ${{
                          model.costPer1KOutput
                        }}/1K
                      </div>
                    </div>
                    <div
                      class="text-xs px-2 py-0.5 rounded-full"
                      :class="
                        configStatus.openai
                          ? 'text-green-600 bg-green-50'
                          : 'text-gray-400 bg-gray-50'
                      "
                    >
                      {{ configStatus.openai ? "⚡ 可用" : "🔒 未配置" }}
                    </div>
                  </label>
                </div>
              </div>

              <!-- 阿里通义系列 -->
              <div>
                <div
                  class="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2"
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    :class="
                      configStatus.dashscope ? 'bg-green-500' : 'bg-gray-400'
                    "
                  ></span>
                  阿里通义 (Qwen)
                  <span class="text-gray-300 text-xs">(需配置 API Key)</span>
                </div>
                <div class="space-y-2">
                  <label
                    v-for="model in qwenModels"
                    :key="model.value"
                    class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    :class="{
                      'opacity-60': !configStatus.dashscope,
                      'border-blue-400 bg-blue-50': selectedModels.includes(
                        model.value,
                      ),
                    }"
                  >
                    <input
                      type="checkbox"
                      :value="model.value"
                      v-model="selectedModels"
                      class="w-4 h-4 mt-0.5"
                      :disabled="!configStatus.dashscope"
                    />
                    <div class="flex-1">
                      <div class="font-medium text-gray-800">
                        {{ model.name }}
                      </div>
                      <div class="text-xs text-gray-400 mt-0.5">
                        {{ model.desc }}
                      </div>
                    </div>
                    <div
                      class="text-xs px-2 py-0.5 rounded-full"
                      :class="
                        configStatus.dashscope
                          ? 'text-green-600 bg-green-50'
                          : 'text-gray-400 bg-gray-50'
                      "
                    >
                      {{ configStatus.dashscope ? "⚡ 可用" : "🔒 未配置" }}
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div class="mt-4 text-xs text-gray-400">
              已选 {{ selectedModels.length }} 个模型，至少 2 个才能横评
            </div>
          </div>
        </div>

        <!-- 执行按钮 -->
        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            @click="runCompare"
            :disabled="
              loading || selectedModels.length < 2
            "
            class="flex-1 rounded-lg bg-blue-500 py-3 font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span v-if="!loading">🚀 开始横评</span>
            <span v-else class="flex items-center justify-center gap-2">
              <span class="animate-spin">⏳</span>
              横评中... 已完成调用 {{ completedCount }}/{{ totalCalls }}（{{ questionsCount }} 个问题 × {{ selectedModels.length }} 个模型）
            </span>
          </button>
          <button
            v-if="compareResults.length > 0"
            @click="resetCompare"
            class="rounded-lg border px-4 py-3 text-gray-600 hover:bg-gray-50"
          >
            重置
          </button>
        </div>
      </div>

      <!-- 对比结果 -->
      <div v-if="compareResults.length > 0" class="space-y-6">
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2">
            📡 能力雷达图
            <span class="text-xs text-gray-400">多维度得分一览</span>
          </h2>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- 雷达图 -->
            <div class="h-[400px]">
              <RadarChart :data="radarData" />
            </div>

            <!-- 图例说明 -->
            <div class="space-y-4">
              <h3 class="text-sm font-medium text-gray-700">维度说明</h3>
              <ul class="space-y-2 text-sm text-gray-600">
                <li class="flex items-center gap-2">
                  <span class="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span class="font-medium">准确性 (40%)</span>
                  <span class="text-gray-400"
                    >- 答案是否正确，有无事实错误</span
                  >
                </li>
                <li class="flex items-center gap-2">
                  <span class="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span class="font-medium">完整性 (25%)</span>
                  <span class="text-gray-400">- 是否覆盖问题涉及的要点</span>
                </li>
                <li class="flex items-center gap-2">
                  <span class="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  <span class="font-medium">相关性 (20%)</span>
                  <span class="text-gray-400">- 回答是否切题</span>
                </li>
                <li class="flex items-center gap-2">
                  <span class="w-3 h-3 bg-purple-500 rounded-full"></span>
                  <span class="font-medium">清晰度 (15%)</span>
                  <span class="text-gray-400">- 表达是否清晰易懂</span>
                </li>
              </ul>
              <div class="bg-blue-50 rounded-lg p-3 mt-4">
                <div class="text-xs text-blue-700">
                  💡 雷达图面积越大，表示该模型综合能力越强。<br />
                  面积趋向于正五边形表示各维度发展均衡。
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 汇总对比卡片 -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2">
            📊 横评汇总
            <span class="text-xs text-gray-400">(按综合得分排序)</span>
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="(model, idx) in sortedResults"
              :key="model.model"
              class="border rounded-lg p-4 transition-all hover:shadow-md"
              :class="{
                'ring-2 ring-blue-500 shadow-md': idx === 0,
                'bg-gradient-to-r from-white to-gray-50': idx === 0,
              }"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="font-semibold text-lg">{{ model.displayName }}</div>
                <div
                  v-if="idx === 0 && model.available !== false && !model.error"
                  class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full"
                >
                  🏆 综合最优
                </div>
                <div
                  v-else-if="model.available === false || model.error"
                  class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
                >
                  ❌ 调用失败
                </div>
              </div>
              <div class="text-3xl font-bold my-2" :class="model.available === false || model.error ? 'text-red-500' : 'text-blue-600'">
                {{
                  model.available === false || model.error
                    ? "--"
                    : model.summary.averageScore.toFixed(1)
                }}<span class="text-sm text-gray-400">分</span>
              </div>
              <div
                v-if="model.available === false || model.error"
                class="mb-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1"
              >
                {{ model.error || "模型调用失败" }}
              </div>
              <div class="space-y-1 text-sm text-gray-500">
                <div class="flex justify-between">
                  <span>⚡ 总耗时</span>
                  <span>{{ model.summary.totalDuration }}ms</span>
                </div>
                <div class="flex justify-between">
                  <span>📊 Token 总数</span>
                  <span>{{ model.summary.totalTokens }}</span>
                </div>
                <div class="flex justify-between">
                  <span>💰 预估成本</span>
                  <span class="text-green-600"
                    >${{ model.summary.totalCost?.toFixed(5) || 0 }}</span
                  >
                </div>
                <div class="flex justify-between">
                  <span>📝 已答条数</span>
                  <span>{{ model.answers.length }}</span>
                </div>
              </div>
              <!-- 各维度平均分 -->
              <div class="mt-3 pt-3 border-t">
                <div class="text-xs text-gray-400 mb-2">各维度平均分</div>
                <div class="grid grid-cols-2 gap-1 text-xs">
                  <div>
                    准确性: {{ model.summary.avgAccuracy?.toFixed(0) || 0 }}
                  </div>
                  <div>
                    完整性: {{ model.summary.avgCompleteness?.toFixed(0) || 0 }}
                  </div>
                  <div>
                    相关性: {{ model.summary.avgRelevance?.toFixed(0) || 0 }}
                  </div>
                  <div>
                    清晰度: {{ model.summary.avgClarity?.toFixed(0) || 0 }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CostAnalysis
          v-if="compareResults.length > 0"
          :results="compareResults"
        />

        <!-- 详细对比表格 -->
        <div class="bg-white rounded-lg shadow-sm overflow-hidden">
          <div
            class="border-b px-6 py-3 bg-gray-50 flex justify-between items-center"
          >
            <h2 class="font-medium text-gray-700">📝 横评明细</h2>
            <div class="flex gap-2">
              <button
                @click="exportCompareResults"
                class="text-sm text-green-600 hover:text-green-700"
              >
                📥 导出 JSON
              </button>
              <button
                @click="copyCompareResults"
                class="text-sm text-blue-600 hover:text-blue-700"
              >
                📋 复制结果
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th
                    class="px-4 py-3 text-left text-sm font-medium text-gray-500 w-64"
                  >
                    问题
                  </th>
                  <th
                    v-for="model in compareResults"
                    :key="model.model"
                    class="px-4 py-3 text-left text-sm font-medium text-gray-500 min-w-[350px]"
                  >
                    <div class="flex items-center gap-2">
                      <span>{{ model.displayName }}</span>
                      <span
                        class="text-xs font-normal px-2 py-0.5 rounded"
                        :class="
                          model.available === false || model.error
                            ? 'text-red-600 bg-red-100'
                            : 'text-gray-500 bg-gray-100'
                        "
                      >
                        {{
                          model.available === false || model.error
                            ? "调用失败"
                            : `平均分 ${model.summary.averageScore.toFixed(1)}`
                        }}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr
                  v-for="(_, qIdx) in questionsList"
                  :key="qIdx"
                  class="hover:bg-gray-50"
                >
                  <td
                    class="px-4 py-3 text-sm text-gray-700 font-medium align-top bg-gray-50"
                  >
                    <div class="max-w-[200px]">
                      {{ questionsList[qIdx] }}
                    </div>
                  </td>
                  <td
                    v-for="model in compareResults"
                    :key="model.model"
                    class="px-4 py-3 align-top"
                  >
                    <div
                      v-if="model.available === false || model.error"
                      class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3"
                    >
                      <div class="font-medium mb-1">该模型本轮调用失败</div>
                      <div class="text-xs">{{ model.error || "请检查模型配置或网络后重试" }}</div>
                    </div>
                    <div v-else class="space-y-3">
                      <!-- 答案内容 -->
                      <div
                        class="text-sm text-gray-600 leading-relaxed max-h-32 overflow-y-auto"
                      >
                        {{ model.answers[qIdx]?.answer || "暂无回答" }}
                      </div>

                      <!-- 评分卡片 -->
                      <div class="bg-gray-50 rounded-lg p-2">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-xs text-gray-500">综合得分</span>
                          <span
                            class="text-base font-bold px-2 py-0.5 rounded"
                            :class="{
                              'bg-green-100 text-green-700':
                                (model.answers[qIdx]?.score || 0) >= 80,
                              'bg-yellow-100 text-yellow-700':
                                (model.answers[qIdx]?.score || 0) >= 60,
                              'bg-red-100 text-red-700':
                                (model.answers[qIdx]?.score || 0) < 60,
                            }"
                          >
                            {{ model.answers[qIdx]?.score || 0 }}分
                          </span>
                        </div>

                        <!-- 各维度评分 -->
                        <div class="grid grid-cols-2 gap-1 text-xs mb-2">
                          <div class="flex justify-between">
                            <span class="text-gray-500">准确性:</span>
                            <span>{{
                              model.answers[qIdx]?.dimensions?.accuracy || 0
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-500">完整性:</span>
                            <span>{{
                              model.answers[qIdx]?.dimensions?.completeness || 0
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-500">相关性:</span>
                            <span>{{
                              model.answers[qIdx]?.dimensions?.relevance || 0
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-500">清晰度:</span>
                            <span>{{
                              model.answers[qIdx]?.dimensions?.clarity || 0
                            }}</span>
                          </div>
                        </div>

                        <!-- 元数据 -->
                        <div
                          class="flex justify-between text-xs text-gray-400 pt-1 border-t"
                        >
                          <span
                            >⏱️ {{ model.answers[qIdx]?.duration || 0 }}ms</span
                          >
                          <span
                            >📊
                            {{ model.answers[qIdx]?.tokens || 0 }} tokens</span
                          >
                        </div>

                        <!-- 评分理由 -->
                        <details class="text-xs mt-2">
                          <summary
                            class="text-gray-400 cursor-pointer hover:text-gray-600"
                          >
                            查看评分理由
                          </summary>
                          <p class="text-gray-500 mt-1 p-2 bg-white rounded">
                            {{ model.answers[qIdx]?.reasoning || "无评分理由" }}
                          </p>
                        </details>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 用例选择 -->
      <div
        v-if="showTestSetModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
          <div class="border-b px-6 py-4 flex justify-between items-center">
            <h3 class="text-lg font-medium">选择用例</h3>
            <button
              @click="showTestSetModal = false"
              class="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div class="p-6 max-h-96 overflow-y-auto">
            <div
              v-if="testSets.length === 0"
              class="text-center text-gray-400 py-8"
            >
              暂无用例，请先到「用例」里新建
            </div>
            <div class="space-y-2">
              <div
                v-for="testSet in testSets"
                :key="testSet.id"
                @click="selectTestSet(testSet)"
                class="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <div class="font-medium">{{ testSet.name }}</div>
                <div class="text-xs text-gray-400 mt-1">
                  {{ testSet.questions?.length || 0 }} 条问题
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import CostAnalysis from "~/components/CostAnalysis.vue";
import { openaiModels, qwenModels, zhipuModels } from "~/composables/useCompareModels";
import { useCompareWorkbench } from "~/composables/useCompareWorkbench";

const {
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
} = useCompareWorkbench();

onMounted(loadConfigStatus);
</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
