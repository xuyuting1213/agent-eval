<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div class="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
            <div class="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2"></div>
          </div>
          <div class="flex gap-2">
            <div class="h-5 w-12 bg-gray-200 rounded animate-pulse"></div>
            <div class="h-5 w-12 bg-gray-200 rounded animate-pulse"></div>
            <div class="h-5 w-12 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- 左侧骨架 -->
        <div class="w-full lg:w-1/2 space-y-6">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div class="h-32 w-full bg-gray-200 rounded animate-pulse"></div>
            <div class="h-4 w-24 bg-gray-200 rounded animate-pulse mt-2"></div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div class="space-y-3">
              <div class="h-16 w-full bg-gray-200 rounded animate-pulse"></div>
              <div class="h-16 w-full bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          <div class="h-12 w-full bg-gray-200 rounded animate-pulse"></div>
        </div>

        <!-- 右侧骨架 -->
        <div class="w-full lg:w-1/2 space-y-6">
          <div class="grid grid-cols-3 gap-4">
            <div class="h-24 bg-gray-200 rounded animate-pulse"></div>
            <div class="h-24 bg-gray-200 rounded animate-pulse"></div>
            <div class="h-24 bg-gray-200 rounded animate-pulse"></div>
          </div>

          <div class="bg-white rounded-lg shadow-sm overflow-hidden">
            <div class="border-b px-6 py-3 bg-gray-50">
              <div class="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div class="divide-y">
              <div v-for="i in 3" :key="i" class="p-6">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
                  <div class="flex-1 space-y-3">
                    <div class="h-5 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                    <div class="h-20 w-full bg-gray-200 rounded animate-pulse"></div>
                    <div class="flex gap-4">
                      <div class="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                      <div class="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>