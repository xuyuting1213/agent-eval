function hasEnv(...keys: string[]): boolean {
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) return true
  }
  return false
}

export default defineEventHandler(() => {
  return {
    zhipu: hasEnv('ZHIPU_API_KEY'),
    openai: hasEnv('OPENAI_API_KEY'),
    dashscope: hasEnv('DASHSCOPE_API_KEY', 'QWEN_API_KEY', 'ALIYUN_API_KEY'),
  }
})