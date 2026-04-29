<template>
  <div class="min-h-screen">
    <nav class="flex gap-4 border-b px-6 py-3 bg-white">
      <NuxtLink to="/" class="hover:text-blue-500">评测</NuxtLink>
      <NuxtLink to="/history" class="hover:text-blue-500">历史记录</NuxtLink>
      <NuxtLink to="/test-sets" class="hover:text-blue-500">测试集</NuxtLink>
      <NuxtLink to="/compare" class="hover:text-blue-500">⚖️ 模型对比</NuxtLink>
    </nav>

    <NuxtPage />
  </div>
</template>
