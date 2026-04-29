<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 头部 -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <h1 class="text-2xl font-bold text-gray-800">📜 评测历史</h1>
        <p class="text-gray-500 text-sm mt-1">查看和管理所有评测记录</p>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <!-- 搜索和筛选 -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div class="flex gap-4">
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索评测内容..."
            class="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            v-model="filterModel"
            class="border rounded-lg px-4 py-2"
          >
            <option value="">全部模型</option>
            <option value="glm-4-flash">GLM-4-Flash</option>
            <option value="glm-4-plus">GLM-4-Plus</option>
          </select>
        </div>
      </div>

      <!-- 评测列表 -->
      <div class="space-y-4">
        <div
          v-for="evalItem in evaluations"
          :key="evalItem.id"
          class="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
          @click="viewDetail(evalItem.id)"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h3 class="font-medium text-lg text-gray-800">{{ evalItem.name }}</h3>
              <div class="flex gap-6 mt-2 text-sm text-gray-500">
                <span>📝 {{ evalItem.totalQuestions }} 个问题</span>
                <span>⭐ 平均分: {{ evalItem.averageScore?.toFixed(1) || 'N/A' }}</span>
                <span>⚡ 平均耗时: {{ evalItem.averageDuration?.toFixed(0) || 0 }}ms</span>
                <span>🤖 模型: {{ evalItem.model }}</span>
              </div>
              <div class="text-xs text-gray-400 mt-2">
                📅 {{ new Date(evalItem.createdAt).toLocaleString() }}
              </div>
            </div>
            <div class="flex gap-2">
              <button
                @click.stop="viewDetail(evalItem.id)"
                class="text-blue-500 hover:text-blue-600 text-sm px-3 py-1"
              >
                查看详情 →
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="evaluations.length === 0 && !loading" class="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">
          <div class="text-4xl mb-2">📭</div>
          <p>暂无评测记录</p>
          <p class="text-sm mt-1">去<a href="/" class="text-blue-500">首页</a>开始第一次评测</p>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">
          <div class="animate-spin text-2xl mb-2">⏳</div>
          <p>加载中...</p>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.totalPages > 1" class="flex justify-center gap-2 mt-6">
        <button
          v-for="page in pagination.totalPages"
          :key="page"
          @click="loadEvaluations(page)"
          :class="[
            'px-3 py-1 rounded',
            pagination.page === page
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          ]"
        >
          {{ page }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const evaluations = ref<any[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const filterModel = ref('')
const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
})

const loadEvaluations = async (page: number = 1) => {
  loading.value = true
  try {
    const response = await $fetch('/api/evaluations', {
      params: {
        page,
        pageSize: pagination.value.pageSize,
      },
    })
    evaluations.value = response.data
    pagination.value = {
      page: response.pagination.page,
      pageSize: response.pagination.pageSize,
      total: response.pagination.total,
      totalPages: response.pagination.totalPages,
    }
  } catch (error) {
    console.error('加载历史记录失败:', error)
  } finally {
    loading.value = false
  }
}

const viewDetail = (id: number) => {
  navigateTo(`/evaluation/${id}`)
}

// 搜索防抖
let debounceTimer: any
watch([searchKeyword, filterModel], () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    loadEvaluations(1)
  }, 300)
})

onMounted(() => {
  loadEvaluations()
})
</script>