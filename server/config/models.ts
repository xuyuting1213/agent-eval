// server/config/models.ts
export interface ModelConfig {
  value: string
  name: string
  provider: 'openai' | 'zhipu' | 'aliyun' | 'baidu' | 'anthropic'
  desc: string
  maxTokens: number
  costPer1KInput: number  // 美元/1K tokens
  costPer1KOutput: number
}

export const modelConfigs: ModelConfig[] = [
  // 智谱系列
  { value: 'glm-4-flash', name: 'GLM-4-Flash', provider: 'zhipu', desc: '快速响应，成本极低', maxTokens: 8000, costPer1KInput: 0.0006, costPer1KOutput: 0.0006 },
  { value: 'glm-4-plus', name: 'GLM-4-Plus', provider: 'zhipu', desc: '最强大脑，复杂推理', maxTokens: 128000, costPer1KInput: 0.05, costPer1KOutput: 0.05 },
  { value: 'glm-4-air', name: 'GLM-4-Air', provider: 'zhipu', desc: '平衡性价比', maxTokens: 8000, costPer1KInput: 0.005, costPer1KOutput: 0.005 },
  { value: 'glm-4-long', name: 'GLM-4-Long', provider: 'zhipu', desc: '超长上下文 1M', maxTokens: 1000000, costPer1KInput: 0.005, costPer1KOutput: 0.005 },
  { value: 'glm-3-turbo', name: 'GLM-3-Turbo', provider: 'zhipu', desc: '经济实惠', maxTokens: 4000, costPer1KInput: 0.001, costPer1KOutput: 0.001 },
  
  // OpenAI 系列（需要配置 OPENAI_API_KEY）
  { value: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', desc: '快速，成本低', maxTokens: 16000, costPer1KInput: 0.0005, costPer1KOutput: 0.0015 },
  { value: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', desc: '强大，适合复杂任务', maxTokens: 128000, costPer1KInput: 0.01, costPer1KOutput: 0.03 },
  { value: 'gpt-4o', name: 'GPT-4o', provider: 'openai', desc: '多模态，最新最强', maxTokens: 128000, costPer1KInput: 0.005, costPer1KOutput: 0.015 },
  
  // 阿里通义系列（需要配置 DASHSCOPE_API_KEY）
  { value: 'qwen-turbo', name: 'Qwen-Turbo', provider: 'aliyun', desc: '快速响应', maxTokens: 8000, costPer1KInput: 0.002, costPer1KOutput: 0.002 },
  { value: 'qwen-plus', name: 'Qwen-Plus', provider: 'aliyun', desc: '平衡性价比', maxTokens: 8000, costPer1KInput: 0.004, costPer1KOutput: 0.006 },
  { value: 'qwen-max', name: 'Qwen-Max', provider: 'aliyun', desc: '最强大模型', maxTokens: 8000, costPer1KInput: 0.02, costPer1KOutput: 0.06 },
]

export function getModelConfig(modelValue: string): ModelConfig | undefined {
  return modelConfigs.find(m => m.value === modelValue)
}

export function getModelsByProvider(provider: string): ModelConfig[] {
  return modelConfigs.filter(m => m.provider === provider)
}