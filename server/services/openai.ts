// OpenAI 调用服务（LangChain ChatOpenAI；兼容智谱 / OpenAI 环境与 previous ZHIPU||OPENAI 行为）

import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import {
  createChatModel,
  messageContentToString,
  usageFromAiMessage,
} from '~/server/services/llm'

export interface OpenAICallResult {
  content: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  duration: number
}

function mapEvaluateError(error: unknown, model: string): Error {
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()

  if (
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('network') ||
    lower.includes('connection')
  ) {
    const hint = process.env.OPENAI_BASE_URL
      ? `当前 OPENAI_BASE_URL=${process.env.OPENAI_BASE_URL}`
      : '未设置 OPENAI_BASE_URL，当前默认使用智谱地址'
    return new Error(`无法连接到模型服务，请检查网络环境或代理设置（${hint}）`)
  }

  if (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key')
  ) {
    return new Error('API Key 无效或已过期，请检查 ZHIPU_API_KEY')
  }

  if (lower.includes('404') || lower.includes('not found')) {
    return new Error(`模型不可用: ${model}`)
  }

  if (lower.includes('429') || lower.includes('rate limit')) {
    return new Error('OpenAI 调用频率超限，请稍后重试')
  }

  return new Error(`模型服务调用失败: ${msg}`)
}

export async function callOpenAI(
  question: string,
  model: string = 'glm-4-flash',
): Promise<OpenAICallResult> {
  const startTime = Date.now()
  const chat = createChatModel(model, { temperature: 0.7 })

  try {
    const response = await chat.invoke([
      new SystemMessage(
        '你是一个专业的 AI 助手，请准确、清晰地回答问题。',
      ),
      new HumanMessage(question),
    ]) as AIMessage

    const duration = Date.now() - startTime
    const usage = usageFromAiMessage(response)

    return {
      content: messageContentToString(response.content),
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      duration,
    }
  } catch (error) {
    throw mapEvaluateError(error, model)
  }
}

export async function batchCallOpenAI(
  questions: string[],
  model: string = 'glm-4-flash',
  concurrency: number = 3,
): Promise<OpenAICallResult[]> {
  const results: OpenAICallResult[] = []

  for (let i = 0; i < questions.length; i += concurrency) {
    const batch = questions.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map((q) => callOpenAI(q, model)),
    )
    results.push(...batchResults)
  }

  return results
}
