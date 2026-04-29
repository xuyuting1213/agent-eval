<template>
  <div class="min-h-screen">
    <nav class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-3 bg-white">
      <NuxtLink
        to="/"
        class="font-semibold text-gray-900 tracking-tight hover:text-blue-600"
      >
        比言
      </NuxtLink>
      <NuxtLink to="/" class="hover:text-blue-500">工作台</NuxtLink>
      <NuxtLink to="/history" class="hover:text-blue-500">记录</NuxtLink>
      <NuxtLink to="/test-sets" class="hover:text-blue-500">用例</NuxtLink>
      <NuxtLink to="/compare" class="hover:text-blue-500">横评</NuxtLink>
    </nav>

    <NuxtPage />
  </div>
</template>
