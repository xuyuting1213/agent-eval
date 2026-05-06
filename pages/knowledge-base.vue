<template>
  <div class="min-h-screen bg-slate-50">
    <main class="mx-auto max-w-6xl px-6 py-6 space-y-6">
      <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h1 class="text-xl font-semibold text-slate-800">📚 知识库管理</h1>
        <p class="text-sm text-slate-500 mt-1">创建知识库、上传文档并用于评测阶段的 RAG 检索。</p>
      </section>

      <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h2 class="text-base font-semibold text-slate-700">新建知识库</h2>
        <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <input
            v-model="createForm.name"
            type="text"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="知识库名称"
          />
          <input
            v-model="createForm.description"
            type="text"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="描述（可选）"
          />
          <button
            :disabled="creating || !createForm.name.trim()"
            class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
            @click="createKnowledgeBase"
          >
            {{ creating ? "创建中..." : "创建" }}
          </button>
        </div>
      </section>

      <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h2 class="text-base font-semibold text-slate-700">上传文档</h2>
        <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <select
            v-model="selectedKbId"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">请选择知识库</option>
            <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
              {{ kb.name }}（{{ kb._count?.documents || 0 }} 文档）
            </option>
          </select>
          <input
            type="file"
            accept=".txt,.md,.pdf,.docx"
            class="block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700"
            @change="onFileChange"
          />
        </div>
        <button
          :disabled="uploading || !selectedKbId || !selectedFile"
          class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
          @click="uploadDocument"
        >
          {{ uploading ? "上传中..." : "上传文档" }}
        </button>
      </section>

      <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 class="text-base font-semibold text-slate-700 mb-3">知识库列表</h2>
        <div v-if="loading" class="text-sm text-slate-400">加载中...</div>
        <div v-else-if="knowledgeBases.length === 0" class="text-sm text-slate-400">暂无知识库</div>
        <div v-else class="space-y-2">
          <div
            v-for="kb in knowledgeBases"
            :key="kb.id"
            class="rounded-lg border border-slate-200 p-3 text-sm"
          >
            <div class="font-medium text-slate-700">{{ kb.name }}</div>
            <div class="text-slate-500">{{ kb.description || "无描述" }}</div>
            <div class="text-xs text-slate-400 mt-1">
              文档 {{ kb._count?.documents || 0 }} / 分块 {{ kb._count?.chunks || 0 }}
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { useMessage } from "naive-ui";

interface KnowledgeBaseItem {
  id: string;
  name: string;
  description?: string | null;
  _count?: { documents: number; chunks: number };
}

const message = useMessage();
const loading = ref(false);
const creating = ref(false);
const uploading = ref(false);
const knowledgeBases = ref<KnowledgeBaseItem[]>([]);
const selectedKbId = ref("");
const selectedFile = ref<File | null>(null);
const createForm = reactive({ name: "", description: "" });

/** 加载知识库列表并自动选中第一项。 */
const loadKnowledgeBases = async () => {
  loading.value = true;
  try {
    const rows = await $fetch("/api/knowledge-base");
    knowledgeBases.value = Array.isArray(rows) ? (rows as KnowledgeBaseItem[]) : [];
    if (!selectedKbId.value && knowledgeBases.value.length > 0) {
      selectedKbId.value = knowledgeBases.value[0].id;
    }
  } catch {
    message.error("加载知识库失败");
  } finally {
    loading.value = false;
  }
};

/** 创建知识库并刷新列表。 */
const createKnowledgeBase = async () => {
  if (!createForm.name.trim()) return;
  creating.value = true;
  try {
    await $fetch("/api/knowledge-base", {
      method: "POST",
      body: {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
      },
    });
    createForm.name = "";
    createForm.description = "";
    message.success("知识库创建成功");
    await loadKnowledgeBases();
  } catch {
    message.error("知识库创建失败");
  } finally {
    creating.value = false;
  }
};

/** 记录待上传文件。 */
const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  selectedFile.value = target?.files?.[0] || null;
};

/** 上传文档并触发后端异步向量化。 */
const uploadDocument = async () => {
  if (!selectedKbId.value || !selectedFile.value) return;
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", selectedFile.value);
    await $fetch(`/api/knowledge-base/${selectedKbId.value}/documents`, {
      method: "POST",
      body: formData,
    });
    selectedFile.value = null;
    message.success("上传成功，后台处理中");
    await loadKnowledgeBases();
  } catch {
    message.error("上传失败");
  } finally {
    uploading.value = false;
  }
};

onMounted(async () => {
  await loadKnowledgeBases();
});
</script>
