// server/services/multiProvider.ts — LangChain ChatOpenAI per provider
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { getModelConfig } from '~/server/config/models'
import {
  createChatModel,
  messageContentToString,
  usageFromAiMessage,
} from '~/server/services/llm'

export interface MultiProviderResult {
  content: string
  totalTokens: number
  duration: number
  cost: number
}

function mapProviderError(
  error: unknown,
  config: NonNullable<ReturnType<typeof getModelConfig>>,
  modelValue: string,
): Error {
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()

  if (
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('network') ||
    lower.includes('connection')
  ) {
    return new Error(`${config.name} 连接失败，请检查网络或代理配置`)
  }

  if (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key')
  ) {
    return new Error(`${config.name} API Key 无效或未配置`)
  }

  if (lower.includes('404') || lower.includes('not found')) {
    return new Error(`${config.name} 模型不存在: ${modelValue}`)
  }

  if (lower.includes('429') || lower.includes('rate limit')) {
    return new Error(`${config.name} 调用频率超限，请稍后重试`)
  }

  if (/\b4\d\d\b/.test(msg) || lower.includes('api error')) {
    return new Error(`${config.name} API 错误: ${msg}`)
  }

  return new Error(`${config.name} 调用失败: ${msg}`)
}

export async function callModel(
  modelValue: string,
  question: string,
): Promise<MultiProviderResult> {
  const config = getModelConfig(modelValue)
  if (!config) {
    throw new Error(`Model not found: ${modelValue}`)
  }

  const startTime = Date.now()
  const chat = createChatModel(modelValue, {
    temperature: 0.7,
    maxTokens: config.maxTokens,
  })

  try {
    const response = (await chat.invoke([
      new SystemMessage(
        '你是一个专业的 AI 助手，请准确、清晰地回答问题。',
      ),
      new HumanMessage(question),
    ])) as AIMessage

    const duration = Date.now() - startTime
    const usage = usageFromAiMessage(response)
    const totalTokens = usage.totalTokens

    const inputCost =
      (usage.promptTokens / 1000) * config.costPer1KInput
    const outputCost =
      (usage.completionTokens / 1000) * config.costPer1KOutput
    const cost = inputCost + outputCost

    return {
      content: messageContentToString(response.content),
      totalTokens,
      duration,
      cost,
    }
  } catch (error) {
    throw mapProviderError(error, config, modelValue)
  }
}
