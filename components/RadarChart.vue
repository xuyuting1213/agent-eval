<template>
  <div ref="chartRef" class="w-full h-full min-h-[300px]"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  data: Array<{
    name: string
    value: number[]
    dimensions: string[]
  }>
}>()

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value) return
  
  if (chart) {
    chart.dispose()
  }
  
  chart = echarts.init(chartRef.value)
  
  const dimensions = props.data[0]?.dimensions || ['准确性', '完整性', '相关性', '清晰度']
  
  const option = {
    radar: {
      indicator: dimensions.map(d => ({ name: d, max: 100 })),
      shape: 'circle',
      center: ['50%', '50%'],
      radius: '65%',
      name: {
        textStyle: {
          fontSize: 12,
          color: '#4B5563'
        }
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.05)']
        }
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const model = params.name
        const values = props.data.find(d => d.name === model)?.value || []
        return `
          <div class="font-bold">${model}</div>
          ${dimensions.map((d, i) => `<div>${d}: ${values[i]}</div>`).join('')}
        `
      }
    },
    legend: {
      data: props.data.map(d => d.name),
      orient: 'vertical',
      left: 'left',
      textStyle: { color: '#374151' }
    },
    series: [{
      type: 'radar',
      data: props.data.map(d => ({
        name: d.name,
        value: d.value,
        areaStyle: {
          opacity: 0.2
        },
        lineStyle: {
          width: 2
        }
      })),
      symbol: 'circle',
      symbolSize: 8,
      label: {
        show: true,
        formatter: (params: any) => `${params.value}`,
        fontSize: 10,
        color: '#4B5563'
      }
    }]
  }
  
  chart.setOption(option)
}

onMounted(() => {
  initChart()
})

watch(() => props.data, () => {
  initChart()
}, { deep: true })
</script>