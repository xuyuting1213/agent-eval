<template>
  <section class="space-y-5">
    <div v-if="results.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-1"><span>⏱️</span> 总耗时</div>
        <div class="text-2xl font-bold text-slate-800">{{ totalDuration }}<span class="text-sm font-normal text-slate-400 ml-1">ms</span></div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-1"><span>⚡</span> 平均耗时</div>
        <div class="text-2xl font-bold text-slate-800">{{ avgDuration }}<span class="text-sm font-normal text-slate-400 ml-1">ms</span></div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-1"><span>📊</span> Token 总数</div>
        <div class="text-2xl font-bold text-slate-800">{{ totalTokens.toLocaleString() }}</div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[50vh] flex flex-col">
      <div class="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
        <h3 class="font-semibold text-slate-700"><span class="text-lg mr-1">📊</span> 评测结果</h3>
        <div class="flex gap-2">
          <button
            v-if="results.length > 0"
            class="text-xs text-slate-500 hover:text-blue-500 px-2 py-1 rounded transition-colors"
            @click="$emit('export')"
          >
            📥 导出 JSON
          </button>
          <button
            v-if="results.length > 0"
            type="button"
            :disabled="savingHistory"
            class="text-xs px-2 py-1 rounded transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            :class="
              savingHistory
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-emerald-500 hover:text-emerald-600'
            "
            :aria-busy="savingHistory"
            @click="$emit('save')"
          >
            <span
              v-if="savingHistory"
              class="inline-block size-3 shrink-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"
              aria-hidden="true"
            />
            {{ savingHistory ? "保存中…" : "💾 保存到历史" }}
          </button>
        </div>
      </div>

      <div class="p-5 flex-1">
        <EvaluateSkeleton v-if="loading && results.length === 0" />
        <div v-else-if="results.length === 0 && !loading" class="text-center py-12 text-slate-400">
          配置完成后，评测结果会实时显示在这里
        </div>

        <div v-else class="space-y-4 min-h-[52vh] max-h-[74vh] overflow-y-auto pr-2">
          <div
            v-for="(result, idx) in results"
            :key="idx"
            class="border rounded-xl overflow-hidden transition-all"
            :class="{
              'border-blue-300 shadow-md shadow-blue-100/50': result.streamStatus === 'streaming',
              'border-emerald-200': result.streamStatus === 'done',
              'border-red-200': result.streamStatus === 'error',
            }"
          >
            <div class="px-4 py-3 bg-slate-50 border-b flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-medium flex items-center justify-center">{{ idx + 1 }}</span>
                <span class="text-sm font-medium text-slate-700 break-words max-w-4xl">{{ submittedQuestions[idx] || `问题 ${idx + 1}` }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span v-if="result.streamStatus === 'streaming'" class="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">⏳ 生成中</span>
                <span v-else-if="result.streamStatus === 'done'" class="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✅ 已完成</span>
                <span v-else-if="result.streamStatus === 'error'" class="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">❌ 失败</span>
                <span
                  v-if="result.score"
                  class="text-sm font-semibold"
                  :class="{
                    'text-emerald-600': result.score >= 80,
                    'text-amber-600': result.score >= 60 && result.score < 80,
                    'text-red-500': result.score < 60,
                  }"
                >
                  {{ result.score }} 分
                </span>
              </div>
            </div>

            <div class="p-4 bg-white">
              <div class="text-xs text-slate-400 mb-2">回答内容</div>
              <div class="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
                <div v-if="!result.content && result.streamStatus === 'streaming'" class="text-slate-400 flex items-center gap-2">
                  <span class="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                  正在生成回答...
                </div>
                <div v-else>{{ result.content || "暂无回答" }}</div>
              </div>
            </div>

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
                  class="text-xs bg-white px-2 py-1 rounded border"
                  :class="
                    result.hasToolCall
                      ? 'border-emerald-200 text-emerald-700'
                      : 'border-slate-200 text-slate-500'
                  "
                  >🔍 工具调用: {{ result.hasToolCall ? "是" : "否" }}</span
                >
                <span
                  v-if="result.hasToolCall"
                  class="text-xs bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-700"
                  >🧰 调用次数: {{ result.toolCallCount || 0 }}</span
                >
                <span
                  class="text-xs bg-white px-2 py-1 rounded border"
                  :class="
                    result.hasKnowledgeHit
                      ? 'border-blue-200 text-blue-700'
                      : 'border-slate-200 text-slate-500'
                  "
                  >📚 知识库命中: {{ result.hasKnowledgeHit ? "是" : "否" }}</span
                >
                <span
                  v-if="result.hasToolCall"
                  class="text-xs bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-700"
                  >🔗 来源数: {{ result.toolSourceCount || 0 }}</span
                >
                <span
                  v-if="result.hasToolCall"
                  class="text-xs bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-700"
                  >⭐ 平均相关度: {{ (result.toolAvgScore || 0).toFixed(3) }}</span
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

            <details v-if="result.dimensions" class="border-t">
              <summary
                class="px-4 py-2 text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
              >
                查看评分维度
              </summary>
              <div class="px-4 pb-3 pt-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
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
                <div class="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                  {{ result.reasoning }}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import EvaluateSkeleton from "~/components/skeletons/EvaluateSkeleton.vue";
import type { EvaluationResultItem } from "~/composables/useEvaluateRunner";

defineProps<{
  loading: boolean;
  /** 正在调用 persist/save，避免重复点击并展示进度。 */
  savingHistory?: boolean;
  results: EvaluationResultItem[];
  submittedQuestions: string[];
  totalDuration: number;
  avgDuration: number;
  totalTokens: number;
}>();

defineEmits<{
  (e: "export"): void;
  (e: "save"): void;
}>();
</script>
