/**
 * GET /api/provider-status
 * 与 config-status 类似、字段略简的提供商 Key 探测（历史/兼容接口）。
 */
export default defineEventHandler(() => {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    zhipu: Boolean(process.env.ZHIPU_API_KEY),
    qwen: Boolean(process.env.DASHSCOPE_API_KEY),
  }
})
