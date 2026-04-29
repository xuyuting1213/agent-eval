<template>
  <n-config-provider>
    <n-dialog-provider>
      <n-message-provider>
        <div class="min-h-screen">
          <nav
            class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-white px-4 py-3 text-sm sm:gap-x-4 sm:px-6"
          >
            <NuxtLink
              to="/"
              class="font-semibold tracking-tight"
              :class="
                isActive('/')
                  ? 'text-blue-600'
                  : 'text-gray-900 hover:text-blue-600'
              "
            >
              比言
            </NuxtLink>
            <NuxtLink to="/" :class="navClass('/')">工作台</NuxtLink>
            <NuxtLink to="/history" :class="navClass('/history')"
              >评测记录</NuxtLink
            >
            <NuxtLink to="/test-sets" :class="navClass('/test-sets')"
              >用例管理</NuxtLink
            >
            <NuxtLink to="/compare" :class="navClass('/compare')"
              >模型横评</NuxtLink
            >
            <NuxtLink to="/performance" :class="navClass('/performance')">
              ⚡ 性能监控
            </NuxtLink>
          </nav>

          <NuxtPage />
        </div>
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NMessageProvider } from "naive-ui";
const route = useRoute();

const isActive = (path: string) => {
  if (path === "/") return route.path === "/";
  return route.path.startsWith(path);
};

const navClass = (path: string) =>
  isActive(path)
    ? "text-blue-600 font-medium"
    : "text-gray-600 hover:text-blue-500";
</script>
