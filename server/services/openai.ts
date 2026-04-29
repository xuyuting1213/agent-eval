/**
 * 工作台主路径用大模型：基于 LangChain `ChatOpenAI`，通过 `createChatModel` 按模型 id 选厂商。
 * 导出 `callOpenAI` / `batchCallOpenAI` 与 token、耗时结构，供 `evaluate.post`、`test-sets/.../run` 等使用。
 */
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

function buildSystemPrompt(): string {
  const now = new Date()
  const nowCN = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)

  return `你是一个专业的 AI 助手，请准确、清晰地回答问题。
当前系统时间（北京时间）是：${nowCN}。
当用户询问今天几号、当前时间、星期几等时，请基于该时间回答。`
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
      new SystemMessage(buildSystemPrompt()),
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
