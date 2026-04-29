<template>
  <div class="bg-white rounded-lg shadow-sm p-6">
    <h2 class="text-lg font-medium mb-4 flex items-center gap-2">
      💰 成本分析
      <span class="text-xs text-gray-400">基于 Token 消耗估算</span>
    </h2>
    
    <div class="space-y-4">
      <!-- 成本对比条形图 -->
      <div>
        <div class="text-sm text-gray-600 mb-2">预估成本对比 (美元)</div>
        <div class="space-y-2">
          <div v-for="model in costData" :key="model.name" class="flex items-center gap-3">
            <div class="w-32 text-sm text-gray-600">{{ model.name }}</div>
            <div class="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="getCostBarClass(model.cost)"
                :style="{ width: getCostPercentage(model.cost) }"
              >
                <span class="text-xs text-white px-2 leading-6">${{ model.cost.toFixed(5) }}</span>
              </div>
            </div>
            <div class="w-20 text-xs text-gray-400 text-right">
              {{ (model.cost * 1000).toFixed(1) }} mills
            </div>
          </div>
        </div>
      </div>
      
      <!-- 成本建议 -->
      <div class="bg-gray-50 rounded-lg p-3 mt-4">
        <div class="text-xs text-gray-600">
          💡 <span class="font-medium">成本建议：</span>
          {{ costRecommendation }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  results: Array<{
    model: string
    displayName: string
    summary: {
      totalCost?: number
      averageScore: number
    }
  }>
}>()

const costData = computed(() => {
  return props.results.map(r => ({
    name: r.displayName,
    cost: r.summary.totalCost || 0,
    score: r.summary.averageScore
  })).sort((a, b) => a.cost - b.cost)
})

const maxCost = computed(() => {
  return Math.max(...costData.value.map(c => c.cost), 0.001)
})

const getCostPercentage = (cost: number) => {
  return `${(cost / maxCost.value) * 100}%`
}

const getCostBarClass = (cost: number) => {
  if (cost < 0.01) return 'bg-green-500'
  if (cost < 0.05) return 'bg-yellow-500'
  return 'bg-red-500'
}

const costRecommendation = computed(() => {
  if (costData.value.length < 2) return '暂无足够数据'
  
  const cheapest = costData.value[0]
  const bestScore = costData.value.reduce((best, curr) => 
    curr.score > best.score ? curr : best, costData.value[0])
  
  if (cheapest.name === bestScore.name) {
    return `${cheapest.name} 既是最经济的($${cheapest.cost.toFixed(5)})，也是得分最高的，强烈推荐！`
  }
  
  return `预算有限推荐 ${cheapest.name} ($${cheapest.cost.toFixed(5)})，追求效果推荐 ${bestScore.name} (${bestScore.score.toFixed(1)}分)`
})
</script>