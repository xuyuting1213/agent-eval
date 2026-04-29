<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 头部保持不变 -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 class="text-xl font-bold text-gray-800 sm:text-2xl">📋 用例</h1>
            <p class="text-gray-500 text-sm mt-1">
              把同一批问题存成用例，工作台与横评可一键载入，专门用来对比模型回答与得分
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-sm sm:gap-4">
            <NuxtLink to="/stats" class="text-blue-500 hover:text-blue-600">
              📊 成本统计
            </NuxtLink>
            <NuxtLink to="/" class="text-blue-500 hover:text-blue-600">
              ← 返回工作台
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <!-- 模型选择 -->
      <n-card size="small" class="mb-6">
        <template #header>🧠 当前选用的模型</template>
        <n-radio-group v-model:value="selectedModel">
          <n-space vertical>
            <n-radio value="glm-4-flash">
              <div class="font-medium">GLM-4-Flash</div>
              <div class="text-xs text-gray-400">题量大、要抢时间时更合适</div>
            </n-radio>
            <n-radio value="glm-4-plus">
              <div class="font-medium">GLM-4-Plus</div>
              <div class="text-xs text-gray-400">
                复杂问题、要更稳的回答时更合适
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </n-card>

      <!-- 新建用例区块保持不变 -->
      <n-card size="small" class="mb-8">
        <template #header>✨ 新建用例</template>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              用例名称 <span class="text-red-500">*</span>
            </label>
            <n-input
              v-model:value="newTestSet.name"
              placeholder="例如：客服场景对比包"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              问题列表 <span class="text-red-500">*</span>
            </label>
            <n-input
              v-model:value="newTestSet.questionsText"
              type="textarea"
              :autosize="{ minRows: 6, maxRows: 10 }"
              placeholder="每行一条问题（将发给各模型），例如：
什么是 Vue 3 的 Composition API？
解释一下 JavaScript 的闭包
React 和 Vue 有什么区别？"
            />
            <div class="text-xs text-gray-400 mt-1">
              共 {{ questionCount }} 条问题
            </div>
          </div>
          <div class="flex justify-end">
            <n-button
              @click="createTestSet"
              :disabled="!newTestSet.name || !newTestSet.questionsText"
              type="primary"
            >
              创建用例
            </n-button>
          </div>
        </div>
      </n-card>

      <!-- 用例列表区块 -->
      <div>
        <h2 class="text-lg font-medium mb-4">📚 我的用例</h2>
        <div v-if="loading" class="space-y-4">
          <div v-for="i in 3" :key="`testset-skeleton-${i}`" class="bg-white rounded-lg shadow-sm p-6">
            <Skeleton height="h-6" width="35%" />
            <div class="mt-3 space-y-2">
              <Skeleton height="h-4" width="55%" />
              <Skeleton height="h-4" width="45%" />
            </div>
            <div class="mt-4 flex gap-2">
              <Skeleton height="h-8" width="90px" />
              <Skeleton height="h-8" width="72px" />
              <Skeleton height="h-8" width="72px" />
            </div>
          </div>
        </div>
        <div
          v-else-if="testSets.length === 0"
          class="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400"
        >
          <div class="text-4xl mb-2">📭</div>
          <p>暂无用例</p>
          <p class="text-sm mt-1">点击上方「新建用例」即可创建第一份</p>
        </div>
        <div v-else class="grid gap-4">
            <div
              v-for="testSet in testSets"
              :key="testSet.id"
              class="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center gap-3 flex-wrap">
                    <h3 class="font-medium text-lg">{{ testSet.name }}</h3>
                    <span
                      class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded"
                    >
                      ID: {{ testSet.id }}
                    </span>
                    <span
                      class="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded"
                    >
                      {{ testSet.questions?.length || 0 }} 条问题
                    </span>
                  </div>
                  <p class="text-gray-400 text-xs mt-2">
                    创建于 {{ new Date(testSet.createdAt).toLocaleString() }}
                  </p>

                  <details class="mt-3">
                    <summary
                      class="text-sm text-gray-500 cursor-pointer hover:text-gray-700"
                    >
                    查看问题列表
                    </summary>
                    <div class="mt-2 space-y-1 pl-4 border-l-2 border-gray-200">
                      <div
                        v-for="(q, idx) in testSet.questions || []"
                        :key="idx"
                        class="text-sm text-gray-600 py-1"
                      >
                        {{ idx + 1 }}. {{ q }}
                      </div>
                    </div>
                  </details>
                </div>
                <div class="ml-0 mt-3 flex flex-wrap gap-2 sm:ml-4 sm:mt-0">
                  <n-button
                    @click="runTestSet(testSet)"
                    :disabled="running"
                    size="small"
                    :type="
                      running && runningTestSetId === testSet.id
                        ? 'default'
                        : 'success'
                    "
                    tertiary
                  >
                    {{
                      running && runningTestSetId === testSet.id
                        ? `⏳ ${progressPercent}%`
                        : "🚀 跑一轮打分"
                    }}
                  </n-button>
                  <n-button
                    @click="useTestSet(testSet)"
                    size="small"
                    type="info"
                    quaternary
                  >
                    使用 →
                  </n-button>
                  <n-button
                    @click="deleteTestSet(testSet.id)"
                    size="small"
                    type="error"
                    quaternary
                  >
                    删除
                  </n-button>
                </div>
              </div>
            </div>
        </div>
      </div>
    </main>

    <!-- 进度弹窗 -->
    <n-modal v-model:show="showProgress" :mask-closable="false">
      <n-card class="w-[420px] text-center" :bordered="false">
        <div class="text-3xl mb-4 animate-spin">⏳</div>
        <p class="font-medium mb-2">正在评测中...</p>
        <p class="text-sm text-gray-500 mb-4">
          第 {{ currentProgress }} / {{ totalProgress }} 条问题
        </p>
        <p v-if="currentQuestionText" class="text-xs text-gray-400 mb-3">
          当前：{{ currentQuestionText }}
        </p>
        <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <n-progress
            type="line"
            :percentage="progressPercent"
            :show-indicator="false"
            :height="10"
            status="info"
            processing
          />
        </div>
        <n-button
          v-if="currentProgress === totalProgress"
          @click="showProgress = false"
          class="mt-4"
          quaternary
          type="primary"
        >
          关闭
        </n-button>
      </n-card>
    </n-modal>

    <!-- 打分结果弹窗（保持不变） -->
    <n-modal v-model:show="showResult">
      <n-card
        v-if="runResult"
        class="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        :bordered="false"
      >
        <div class="border-b px-6 py-4 flex justify-between items-center">
          <h3 class="text-lg font-medium">
            📊 打分报告：{{ runResult.testSet?.name }}
          </h3>
          <n-button @click="closeResult" quaternary circle> ✕ </n-button>
        </div>

        <div class="p-6 overflow-y-auto flex-1">
          <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-blue-600">
                {{ runResult.summary?.totalQuestions }}
              </div>
              <div class="text-xs text-gray-500">问题条数</div>
            </div>
            <div class="bg-green-50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-green-600">
                {{ runResult.summary?.avgScore }}
              </div>
              <div class="text-xs text-gray-500">平均得分</div>
            </div>
            <div class="bg-yellow-50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-yellow-600">
                {{ runResult.summary?.totalDuration }}
              </div>
              <div class="text-xs text-gray-500">总耗时</div>
            </div>
            <div class="bg-purple-50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-purple-600">
                {{ runResult.summary?.totalTokens }}
              </div>
              <div class="text-xs text-gray-500">Token 总数</div>
            </div>
          </div>

          <h4 class="font-medium mb-3">详细结果</h4>
          <div class="space-y-4">
            <div
              v-for="(item, idx) in runResult.details"
              :key="idx"
              class="border rounded-lg p-4"
            >
              <div class="font-medium text-gray-800 mb-2">
                {{ Number(idx) + 1 }}. {{ item.question }}
              </div>
              <div class="text-gray-600 text-sm mb-2">{{ item.content }}</div>
              <div class="flex items-center gap-4 text-sm">
                <span class="text-green-600 font-medium"
                  >得分: {{ item.score }}</span
                >
                <span class="text-gray-400">耗时: {{ item.duration }}ms</span>
                <span class="text-gray-400"
                  >Tokens: {{ item.totalTokens }}</span
                >
              </div>
              <details class="mt-2">
                <summary class="text-xs text-gray-400 cursor-pointer">
                  评分明细
                </summary>
                <div class="mt-2 text-xs text-gray-500">
                  <div>准确性: {{ item.dimensions?.accuracy || 0 }}</div>
                  <div>完整性: {{ item.dimensions?.completeness || 0 }}</div>
                  <div>相关性: {{ item.dimensions?.relevance || 0 }}</div>
                  <div>清晰度: {{ item.dimensions?.clarity || 0 }}</div>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div class="border-t px-6 py-4 flex justify-end gap-3">
          <n-button @click="copyReport" type="default"> 📋 复制报告 </n-button>
          <n-button @click="closeResult" type="primary"> 关闭 </n-button>
        </div>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import {
  useDialog,
  useMessage,
  NButton,
  NCard,
  NInput,
  NModal,
  NProgress,
  NRadio,
  NRadioGroup,
  NSpace,
  NSpin,
} from "naive-ui";
import { useTestSetCrud } from "~/composables/useTestSetCrud";
import { useTestSetRunner } from "~/composables/useTestSetRunner";

const message = useMessage();
const dialog = useDialog();
const selectedModel = ref<"glm-4-flash" | "glm-4-plus">("glm-4-flash");

const {
  testSets,
  loading,
  newTestSet,
  questionCount,
  loadTestSets,
  createTestSet,
  useTestSet: baseUseTestSet,
  deleteTestSet,
} = useTestSetCrud(message, dialog);

const {
  running,
  runningTestSetId,
  runResult,
  showResult,
  showProgress,
  currentProgress,
  totalProgress,
  progressPercent,
  currentQuestionText,
  runTestSet,
  copyReport,
  closeResult,
} = useTestSetRunner(selectedModel, testSets, message);

const useTestSet = (testSet: (typeof testSets.value)[number]) => {
  baseUseTestSet(testSet, selectedModel.value);
};

onMounted(() => {
  const route = useRoute();
  const modelFromQuery = route.query.model;
  if (modelFromQuery === "glm-4-flash" || modelFromQuery === "glm-4-plus") {
    selectedModel.value = modelFromQuery;
  }
  loadTestSets();
});

watch(selectedModel, (value) => {
  navigateTo({ path: "/test-sets", query: { model: value } }, { replace: true });
});
</script>
