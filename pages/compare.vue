<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 头部 -->
    <header class="bg-white shadow-sm border-b sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">⚖️ 模型对比</h1>
            <p class="text-gray-500 text-sm mt-1">
              并排对比多个 AI 模型的表现，找到最适合你的模型
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

    <main class="max-w-7xl mx-auto px-4 py-8">
      <!-- 配置区 -->
      <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- 左侧：问题输入 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                📝 测试问题
              </label>
              <button
                @click="loadFromTestSet"
                class="text-xs text-blue-500 hover:text-blue-600"
              >
                从测试集加载
              </button>
            </div>
            <textarea
              v-model="questionsText"
              rows="8"
              class="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="每行一个问题，例如：
什么是 Vue 3 的 Composition API？
解释一下 JavaScript 的闭包
React 和 Vue 有什么区别？
什么是 TailwindCSS？
TypeScript 的好处是什么？"
            />
            <div class="flex justify-between mt-2">
              <div class="text-xs text-gray-400">
                共 {{ questionsCount }} 个问题
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
                🧠 选择对比模型
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

            <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2">
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
                    :class="configStatus.openai ? 'bg-green-500' : 'bg-gray-400'"
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
              已选择 {{ selectedModels.length }} 个模型，至少选择 2 个进行对比
            </div>
          </div>
        </div>

        <!-- 执行按钮 -->
        <div class="mt-6 flex gap-3">
          <button
            @click="runCompare"
            :disabled="
              loading || questionsCount === 0 || selectedModels.length < 2
            "
            class="flex-1 bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="!loading">🚀 开始对比评测</span>
            <span v-else class="flex items-center justify-center gap-2">
              <span class="animate-spin">⏳</span>
              对比评测中... ({{ completedCount }}/{{ totalCalls }})
            </span>
          </button>
          <button
            v-if="compareResults.length > 0"
            @click="resetCompare"
            class="px-4 py-3 border rounded-lg text-gray-600 hover:bg-gray-50"
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
            <span class="text-xs text-gray-400">多维度能力对比</span>
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
                  <span class="text-gray-400">- 是否覆盖问题所有方面</span>
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
            📊 模型汇总对比
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
                  v-if="idx === 0"
                  class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full"
                >
                  🏆 综合最优
                </div>
              </div>
              <div class="text-3xl font-bold text-blue-600 my-2">
                {{ model.summary.averageScore.toFixed(1)
                }}<span class="text-sm text-gray-400">分</span>
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
                  <span>📝 回答问题数</span>
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
            <h2 class="font-medium text-gray-700">📝 详细对比结果</h2>
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
                      <span class="text-xs font-normal text-gray-400">
                        ({{ model.summary.averageScore.toFixed(0) }}分)
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
                    <div class="space-y-3">
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

      <!-- 测试集选择模态框 -->
      <div
        v-if="showTestSetModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
          <div class="border-b px-6 py-4 flex justify-between items-center">
            <h3 class="text-lg font-medium">选择测试集</h3>
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
              暂无测试集，请先在首页创建
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
                  {{ testSet.questions?.length || 0 }} 个问题
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
import { ref, computed, onMounted } from "vue";
import CostAnalysis from "~/components/CostAnalysis.vue";
// ==================== 模型配置 ====================
const zhipuModels = [
  {
    value: "glm-4-flash",
    name: "GLM-4-Flash",
    desc: "快速响应，成本极低，适合高频调用",
    costPer1KInput: 0.0006,
    costPer1KOutput: 0.0006,
  },
  {
    value: "glm-4-plus",
    name: "GLM-4-Plus",
    desc: "最强大脑，复杂推理，成本较高",
    costPer1KInput: 0.05,
    costPer1KOutput: 0.05,
  },
  {
    value: "glm-4-air",
    name: "GLM-4-Air",
    desc: "平衡性价比，适中速度",
    costPer1KInput: 0.005,
    costPer1KOutput: 0.005,
  },
  {
    value: "glm-4-long",
    name: "GLM-4-Long",
    desc: "超长上下文 1M tokens，适合处理长文档",
    costPer1KInput: 0.005,
    costPer1KOutput: 0.005,
  },
  {
    value: "glm-3-turbo",
    name: "GLM-3-Turbo",
    desc: "经济实惠，简单任务专用",
    costPer1KInput: 0.001,
    costPer1KOutput: 0.001,
  },
];

const openaiModels = [
  {
    value: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    desc: "快速响应，成本较低",
    costPer1KInput: 0.0005,
    costPer1KOutput: 0.0015,
  },
  {
    value: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    desc: "强大，适合复杂任务",
    costPer1KInput: 0.01,
    costPer1KOutput: 0.03,
  },
  {
    value: "gpt-4o",
    name: "GPT-4o",
    desc: "多模态，最新最强",
    costPer1KInput: 0.005,
    costPer1KOutput: 0.015,
  },
];

const qwenModels = [
  {
    value: "qwen-turbo",
    name: "Qwen-Turbo",
    desc: "快速响应",
    costPer1KInput: 0.002,
    costPer1KOutput: 0.002,
  },
  {
    value: "qwen-plus",
    name: "Qwen-Plus",
    desc: "平衡性价比",
    costPer1KInput: 0.004,
    costPer1KOutput: 0.006,
  },
];
// 添加雷达图数据计算
const radarData = computed(() => {
  return compareResults.value.map((model) => {
    // 计算各维度平均分
    const avgAccuracy =
      model.answers.reduce(
        (sum: number, a: any) => sum + (a.dimensions?.accuracy || 0),
        0,
      ) / model.answers.length;
    const avgCompleteness =
      model.answers.reduce(
        (sum: number, a: any) => sum + (a.dimensions?.completeness || 0),
        0,
      ) / model.answers.length;
    const avgRelevance =
      model.answers.reduce(
        (sum: number, a: any) => sum + (a.dimensions?.relevance || 0),
        0,
      ) / model.answers.length;
    const avgClarity =
      model.answers.reduce(
        (sum: number, a: any) => sum + (a.dimensions?.clarity || 0),
        0,
      ) / model.answers.length;

    return {
      name: model.displayName,
      value: [avgAccuracy, avgCompleteness, avgRelevance, avgClarity],
      dimensions: ["准确性", "完整性", "相关性", "清晰度"],
    };
  });
});
// ==================== 状态 ====================
const questionsText = ref("");
const selectedModels = ref<string[]>(["glm-4-flash", "glm-4-plus"]);
const loading = ref(false);
const compareResults = ref<any[]>([]);
const showTestSetModal = ref(false);
const testSets = ref<any[]>([]);

// ==================== 计算属性 ====================
const questionsCount = computed(() => {
  return questionsText.value.split("\n").filter((q) => q.trim()).length;
});

const questionsList = computed(() => {
  return questionsText.value.split("\n").filter((q) => q.trim());
});

const configStatus = ref({ zhipu: false, openai: false, dashscope: false });

const totalCalls = computed(() => {
  return selectedModels.value.length * questionsCount.value;
});

const completedCount = ref(0);

const sortedResults = computed(() => {
  return [...compareResults.value].sort(
    (a, b) => b.summary.averageScore - a.summary.averageScore,
  );
});

// ==================== 方法 ====================
const getModelDisplayName = (modelValue: string) => {
  const allModels = [...zhipuModels, ...openaiModels, ...qwenModels];
  const model = allModels.find((m) => m.value === modelValue);
  return model?.name || modelValue;
};

const selectAllModels = () => {
  selectedModels.value = zhipuModels.map((m) => m.value);
};

const deselectAllModels = () => {
  selectedModels.value = [];
};

const clearQuestions = () => {
  questionsText.value = "";
};

const loadFromTestSet = async () => {
  try {
    testSets.value = await $fetch("/api/test-sets");
    showTestSetModal.value = true;
  } catch (error) {
    console.error("加载测试集失败:", error);
  }
};

const selectTestSet = (testSet: any) => {
  if (testSet.questions && Array.isArray(testSet.questions)) {
    questionsText.value = testSet.questions.join("\n");
  }
  showTestSetModal.value = false;
};

const runCompare = async () => {
  const questions = questionsText.value.split("\n").filter((q) => q.trim());

  if (questions.length === 0) {
    alert("请至少输入一个问题");
    return;
  }

  if (selectedModels.value.length < 2) {
    alert("请至少选择 2 个模型进行对比");
    return;
  }

  loading.value = true;
  completedCount.value = 0;
  compareResults.value = [];

  try {
    const response = await $fetch("/api/compare", {
      method: "POST",
      body: {
        questions,
        models: selectedModels.value,
      },
    });

    compareResults.value = response.models.map((m: any) => ({
      ...m,
      displayName: getModelDisplayName(m.model),
    }));
  } catch (error: any) {
    console.error("对比失败:", error);
    alert(`对比失败: ${error.data?.message || error.message}`);
  } finally {
    loading.value = false;
  }
};

const resetCompare = () => {
  compareResults.value = [];
  questionsText.value = "";
};

const exportCompareResults = () => {
  const data = {
    timestamp: new Date().toISOString(),
    questions: questionsList.value,
    models: compareResults.value.map((m) => ({
      model: m.model,
      displayName: m.displayName,
      summary: m.summary,
      answers: m.answers,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `compare_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const copyCompareResults = () => {
  const text = compareResults.value
    .map((m) => {
      return `${m.displayName}: ${m.summary.averageScore.toFixed(1)}分`;
    })
    .join("\n");

  navigator.clipboard.writeText(text);
  alert("已复制汇总结果到剪贴板");
};

// ==================== 生命周期 ====================
onMounted(async () => {
  try {
    const status = await $fetch<{
      zhipu: boolean;
      openai: boolean;
      dashscope: boolean;
    }>("/api/config-status");
    configStatus.value = status;
  } catch (e) {
    console.error("加载配置状态失败:", e);
  }
});
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
