export default defineEventHandler(() => {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    zhipu: Boolean(process.env.ZHIPU_API_KEY),
    qwen: Boolean(process.env.DASHSCOPE_API_KEY),
  }
})
