<template>
  <section class="space-y-4">
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 overflow-hidden">
      <div class="px-5 py-3.5 border-b border-blue-200 bg-white/50">
        <h3 class="font-semibold text-blue-800">
          <span class="text-lg mr-1">⚡</span> 快速运行
        </h3>
      </div>
      <div class="p-4">
        <div class="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-center gap-3">
          <div class="flex items-center gap-3 rounded-lg bg-white px-3 py-1.5 shadow-sm">
          <span class="text-xs text-slate-400">问题</span>
          <span class="text-lg font-bold text-blue-600">{{ questionCount }}</span>
          <span class="text-slate-300">|</span>
          <span class="text-xs text-slate-400">进度</span>
          <span class="text-lg font-bold text-emerald-600">{{ completedCount }}</span>
          <span class="text-sm text-slate-400">/{{ questionCount }}</span>
          </div>
          <div v-if="loading && questionCount > 0">
          <div class="flex justify-between text-xs text-slate-500 mb-1">
            <span>评测进度</span>
            <span>{{ Math.round((completedCount / questionCount) * 100) }}%</span>
          </div>
          <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-500 transition-all duration-300 rounded-full"
              :style="{ width: `${(completedCount / questionCount) * 100}%` }"
            ></div>
          </div>
        </div>
          <div class="flex items-center justify-end gap-2">
            <div class="flex items-center justify-between bg-white rounded-lg px-3 py-2 min-w-30">
              <div class="text-xs text-slate-500">联网搜索</div>
              <n-switch
                :value="enableTools"
                size="small"
                @update:value="(value) => $emit('update:enableTools', value)"
              />
            </div>
            <button
              :disabled="loading || questionCount === 0"
              class="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              @click="$emit('run')"
            >
              <span v-if="!loading">▶ 开始评测</span>
              <span v-else>⏳ 评测中</span>
            </button>
            <button
              v-if="loading"
              class="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-all"
              @click="$emit('cancel')"
            >
              🛑 中断
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-6">
        <div class="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
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
            :value="questionsText"
            rows="6"
            class="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none font-mono"
            placeholder="每行一个问题，例如：&#10;什么是 Vue 3 的 Composition API？&#10;解释一下 JavaScript 的闭包&#10;React 和 Vue 有什么区别？"
            @input="onQuestionsInput"
          ></textarea>
          <div class="flex justify-between items-center mt-3">
            <div class="flex items-center gap-3 text-xs text-slate-400">
              <span>📋 共 <span class="font-semibold text-slate-600">{{ questionCount }}</span> 条</span>
              <span v-if="completedCount > 0" class="text-emerald-600">✅ 已完成 {{ completedCount }}</span>
            </div>
            <button
              class="text-xs text-slate-400 hover:text-red-400 transition-colors"
              @click="$emit('clear')"
            >
              清空
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-3">
        <div class="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h3 class="font-semibold text-slate-700">
            <span class="text-lg mr-1">🧠</span> 模型选型
          </h3>
        </div>
        <div class="p-4">
          <div class="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto">
            <div
              v-for="model in modelOptions"
              :key="model.value"
              class="cursor-pointer rounded-lg border p-3 transition-all"
              :class="[
                selectedModel === model.value
                  ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-400'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
              ]"
              @click="$emit('update:selectedModel', model.value)"
            >
              <div class="text-sm font-medium text-slate-800">{{ model.name }}</div>
              <div class="text-xs text-slate-400 mt-0.5">{{ model.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-3">
        <div class="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h3 class="font-semibold text-slate-700">
            <span class="text-lg mr-1">🏢</span> 业务场景
          </h3>
        </div>
        <div class="p-4">
          <div class="grid grid-cols-1 gap-2">
            <div
              v-for="scenario in scenarios"
              :key="scenario.id"
              class="cursor-pointer rounded-lg border p-3 transition-all"
              :class="[
                selectedScenario === scenario.id
                  ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-400'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
              ]"
              @click="$emit('update:selectedScenario', scenario.id)"
            >
              <div class="text-sm font-medium text-slate-800">
                {{ scenario.icon }} {{ scenario.name }}
              </div>
              <div class="text-xs text-slate-400 mt-0.5">{{ scenario.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-6">
        <div class="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h3 class="font-semibold text-slate-700">
            <span class="text-lg mr-1">📚</span> 知识库（RAG）
          </h3>
        </div>
        <div class="p-4">
          <select
            :value="selectedKnowledgeBase ?? ''"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            @change="onKnowledgeBaseChange"
          >
            <option value="">不使用知识库</option>
            <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
              {{ kb.name }}（{{ kb._count?.documents || 0 }} 文档）
            </option>
          </select>
          <div class="text-xs text-slate-400 mt-2">选择后模型可调用 knowledge_search 基于企业文档回答</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { NSwitch } from "naive-ui";
import type { ModelOption } from "~/composables/useModelOptions";

defineProps<{
  loading: boolean;
  questionCount: number;
  completedCount: number;
  enableTools: boolean;
  questionsText: string;
  selectedModel: string;
  selectedScenario: string;
  selectedKnowledgeBase: string | null;
  scenarios: Array<{ id: string; name: string; description: string; icon: string }>;
  knowledgeBases: Array<{ id: string; name: string; _count?: { documents: number; chunks: number } }>;
  modelOptions: ModelOption[];
}>();

const emit = defineEmits<{
  (e: "run"): void;
  (e: "cancel"): void;
  (e: "clear"): void;
  (e: "update:enableTools", value: boolean): void;
  (e: "update:questionsText", value: string): void;
  (e: "update:selectedModel", value: string): void;
  (e: "update:selectedScenario", value: string): void;
  (e: "update:selectedKnowledgeBase", value: string | null): void;
}>();

/** 同步问题输入文本，避免模板内类型断言语法报错。 */
const onQuestionsInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement | null;
  emit("update:questionsText", target?.value ?? "");
};

/** 将 select 值规范化为 string|null。 */
const onKnowledgeBaseChange = (event: Event) => {
  const target = event.target as HTMLSelectElement | null;
  emit("update:selectedKnowledgeBase", target?.value || null);
};
</script>
