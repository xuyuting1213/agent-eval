<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 头部 -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">📋 测试集管理</h1>
            <p class="text-gray-500 text-sm mt-1">创建和管理评测问题集</p>
          </div>
          <NuxtLink to="/" class="text-blue-500 hover:text-blue-600">
            ← 返回首页
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-3">
          🧠 当前评测模型
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
              <div class="text-xs text-gray-400">速度快，适合快速评测</div>
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
              <div class="text-xs text-gray-400">效果更强，适合复杂问题</div>
            </div>
          </label>
        </div>
      </div>

      <!-- 创建测试集表单 -->
      <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 class="text-lg font-medium mb-4">✨ 新建测试集</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              名称 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="newTestSet.name"
              type="text"
              placeholder="例如：前端面试题"
              class="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              问题列表 <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="newTestSet.questionsText"
              rows="6"
              placeholder="每行一个问题，例如：
什么是 Vue 3 的 Composition API？
解释一下 JavaScript 的闭包
React 和 Vue 有什么区别？"
              class="w-full border rounded-lg px-4 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div class="text-xs text-gray-400 mt-1">
              共 {{ questionCount }} 个问题
            </div>
          </div>
          <div class="flex justify-end">
            <button
              @click="createTestSet"
              :disabled="!newTestSet.name || !newTestSet.questionsText"
              class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              创建测试集
            </button>
          </div>
        </div>
      </div>

      <!-- 测试集列表 -->
      <div>
        <h2 class="text-lg font-medium mb-4">📚 我的测试集</h2>
        <div v-if="loading" class="text-center py-12 text-gray-400">
          加载中...
        </div>
        <div
          v-else-if="testSets.length === 0"
          class="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400"
        >
          <div class="text-4xl mb-2">📭</div>
          <p>暂无测试集</p>
          <p class="text-sm mt-1">点击上方「新建测试集」创建你的第一个测试集</p>
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
                    {{ testSet.questions?.length || 0 }} 个问题
                  </span>
                </div>
                <p class="text-gray-400 text-xs mt-2">
                  创建于 {{ new Date(testSet.createdAt).toLocaleString() }}
                </p>

                <!-- 问题预览 -->
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
                      {{ Number(idx) + 1 }}. {{ q }}
                    </div>
                  </div>
                </details>
              </div>
              <div class="flex gap-2 ml-4">
                <button
                  @click="runTestSet(testSet)"
                  :disabled="running"
                  class="text-sm px-3 py-1 rounded transition-colors"
                  :class="
                    running && runningTestSetId === testSet.id
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      : 'text-green-500 hover:text-green-600 hover:bg-green-50'
                  "
                >
                  {{
                    running && runningTestSetId === testSet.id
                      ? "⏳ 评测中..."
                      : "🚀 开始评测"
                  }}
                </button>
                <button
                  @click="useTestSet(testSet)"
                  class="text-blue-500 hover:text-blue-600 text-sm px-3 py-1 rounded hover:bg-blue-50"
                >
                  使用 →
                </button>
                <button
                  @click="deleteTestSet(testSet.id)"
                  class="text-red-400 hover:text-red-500 text-sm px-3 py-1 rounded hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <!-- 评测结果弹窗 -->
    <div
      v-if="showResult && runResult"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div class="border-b px-6 py-4 flex justify-between items-center">
          <h3 class="text-lg font-medium">
            📊 评测报告：{{ runResult.testSet?.name }}
          </h3>
          <button
            @click="closeResult"
            class="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div class="p-6 overflow-y-auto flex-1">
          <!-- 汇总卡片 -->
          <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-blue-600">
                {{ runResult.summary?.totalQuestions }}
              </div>
              <div class="text-xs text-gray-500">问题数量</div>
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

          <!-- 详细结果 -->
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
            </div>
          </div>
        </div>

        <div class="border-t px-6 py-4 flex justify-end">
          <button
            @click="closeResult"
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";

interface TestSetItem {
  id: number;
  name: string;
  questions: string[];
  createdAt: string;
}

const testSets = ref<TestSetItem[]>([]);
const loading = ref(false);
const selectedModel = ref<"glm-4-flash" | "glm-4-plus">("glm-4-flash");

const newTestSet = ref({
  name: "",
  questionsText: "",
});

const questionCount = computed(() => {
  return newTestSet.value.questionsText.split("\n").filter((q) => q.trim())
    .length;
});

// 加载测试集列表
const loadTestSets = async () => {
  loading.value = true;
  try {
    // Avoid deep typed-route inference stack overflow in TS plugin
    const apiPath = "/api/test-sets" as string;
    testSets.value = await $fetch<TestSetItem[]>(apiPath);
  } catch (error) {
    console.error("加载测试集失败:", error);
  } finally {
    loading.value = false;
  }
};

// 创建测试集
const createTestSet = async () => {
  if (!newTestSet.value.name) {
    alert("请输入测试集名称");
    return;
  }

  const questions = newTestSet.value.questionsText
    .split("\n")
    .filter((q) => q.trim());

  if (questions.length === 0) {
    alert("请至少输入一个问题");
    return;
  }

  try {
    await $fetch("/api/test-sets", {
      method: "POST",
      body: {
        name: newTestSet.value.name,
        questions,
      },
    });
    newTestSet.value = { name: "", questionsText: "" };
    await loadTestSets();
    alert("创建成功！");
  } catch (error) {
    console.error("创建失败:", error);
    alert("创建失败");
  }
};

// 使用测试集（跳转到首页并填充问题）
const useTestSet = (testSet: any) => {
  const questions = testSet.questions.join("\n");
  sessionStorage.setItem("testQuestions", questions);
  navigateTo({ path: "/", query: { model: selectedModel.value } });
};

// 删除测试集
const deleteTestSet = async (id: number) => {
  if (!confirm("确定要删除这个测试集吗？")) return;

  try {
    await $fetch(`/api/test-sets/${id}`, { method: "DELETE" });
    await loadTestSets();
    alert("删除成功！");
  } catch (error) {
    console.error("删除失败:", error);
    alert("删除失败");
  }
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
// 添加状态
const running = ref(false);
const runningTestSetId = ref<number | null>(null);
const runResult = ref<any>(null);
const showResult = ref(false);

// 开始评测
const runTestSet = async (testSet: any) => {
  if (running.value) return;
  running.value = true;
  runningTestSetId.value = testSet.id;
  showResult.value = false;

  try {
    const result = await $fetch(`/api/test-sets/${testSet.id}/run`, {
      method: "POST",
      body: {
        model: selectedModel.value,
      },
    });
    runResult.value = result;
    showResult.value = true;
  } catch (error) {
    console.error("评测失败:", error);
    alert("评测失败");
  } finally {
    running.value = false;
    runningTestSetId.value = null;
  }
};

// 关闭结果弹窗
const closeResult = () => {
  showResult.value = false;
  runResult.value = null;
};
</script>
