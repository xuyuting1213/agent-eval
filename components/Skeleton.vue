<template>
  <div class="animate-pulse">
    <div class="bg-gray-200 rounded" :class="heightClass" :style="{ width: width }"></div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  height: {
    type: String,
    default: 'h-4'
  },
  width: {
    type: String,
    default: '100%'
  }
})

const heightClass = computed(() => props.height)
</script>