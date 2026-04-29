/**
 * LangChain 侧「统一大模型入口」。
 *
 * - 根据 `server/config/models.ts` 里模型的 `provider`，解析对应的 API Key 与 OpenAI 兼容 baseURL。
 * - 对外暴露 `createChatModel`，供 openai / multiProvider / scorer 等复用，避免各文件重复拼客户端。
 * - `messageContentToString` / `usageFromAiMessage`：把 LangChain `AIMessage` 转成业务里习惯的字符串与 token 统计。
 */

import { ChatOpenAI } from '@langchain/openai'
import type { AIMessage } from '@langchain/core/messages'
import { getModelConfig, type ModelConfig } from '~/server/config/models'

/**
 * 将 Chat 接口返回的 `content` 统一成纯文本。
 * 部分厂商/场景下 content 可能是 string，也可能是多段结构（如含 text 片段的数组）。
 */
export function messageContentToString(
  content: AIMessage['content'],
): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text: string }).text)
        }
        return ''
      })
      .join('')
  }
  return ''
}

/**
 * 从 `AIMessage` 提取 token 用量，兼容两套字段：
 * - LangChain 较新：`usage_metadata`（input_tokens / output_tokens / total_tokens）
 * - 部分路径：`response_metadata.tokenUsage`（promptTokens / completionTokens / totalTokens）
 */
export function usageFromAiMessage(msg: AIMessage): {
  promptTokens: number
  completionTokens: number
  totalTokens: number
} {
  const um = msg.usage_metadata
  if (um) {
    const input = um.input_tokens ?? 0
    const output = um.output_tokens ?? 0
    const total = um.total_tokens ?? input + output
    return {
      promptTokens: input,
      completionTokens: output,
      totalTokens: total,
    }
  }
  const tu = msg.response_metadata?.tokenUsage as
    | {
        promptTokens?: number
        completionTokens?: number
        totalTokens?: number
      }
    | undefined
  if (tu) {
    const promptTokens = tu.promptTokens ?? 0
    const completionTokens = tu.completionTokens ?? 0
    const totalTokens =
      tu.totalTokens ?? promptTokens + completionTokens
    return { promptTokens, completionTokens, totalTokens }
  }
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}

/**
 * 按厂商解析鉴权与环境：返回调用 OpenAI 兼容 Chat Completions 所需的 `apiKey` + `baseURL`。
 *
 * | provider | 环境变量（Key） | baseURL 说明 |
 * |----------|----------------|--------------|
 * | zhipu    | ZHIPU_API_KEY  | 默认智谱 OpenAI 兼容地址；可被 ZHIPU_BASE_URL / OPENAI_BASE_URL 覆盖 |
 * | openai   | OPENAI_API_KEY | 默认官方 v1；可被 OPENAI_BASE_URL 覆盖（代理/第三方网关） |
 * | aliyun   | DASHSCOPE / QWEN / ALIYUN | 固定 dashscope 兼容模式地址 |
 */
export function resolveProviderEnv(
  provider: ModelConfig['provider'],
): { apiKey: string; baseURL: string } {
  switch (provider) {
    case 'zhipu': {
      const apiKey = process.env.ZHIPU_API_KEY
      if (!apiKey?.trim()) {
        throw new Error('ZHIPU_API_KEY is not configured')
      }
      const baseURL =
        process.env.ZHIPU_BASE_URL?.trim() ||
        process.env.OPENAI_BASE_URL?.trim() ||
        'https://open.bigmodel.cn/api/paas/v4'
      return { apiKey, baseURL }
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey?.trim()) {
        throw new Error('OPENAI_API_KEY is not configured')
      }
      const baseURL =
        process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1'
      return { apiKey, baseURL }
    }
    case 'aliyun': {
      const apiKey =
        process.env.DASHSCOPE_API_KEY?.trim() ||
        process.env.QWEN_API_KEY?.trim() ||
        process.env.ALIYUN_API_KEY?.trim()
      if (!apiKey) {
        throw new Error(
          'DASHSCOPE_API_KEY (or QWEN_API_KEY / ALIYUN_API_KEY) is not configured',
        )
      }
      const baseURL =
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
      return { apiKey, baseURL }
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

/** 传给 `createChatModel` 的可选生成参数（未传则用模型配置或类内默认值）。 */
export interface CreateChatModelOptions {
  temperature?: number
  maxTokens?: number
}

/**
 * 根据「模型 id」（如 `glm-4-flash`、`gpt-4o`）创建已配置好的 `ChatOpenAI`。
 *
 * 流程：`modelValue` → `getModelConfig` 取 `provider` → `resolveProviderEnv` → `new ChatOpenAI({ configuration: { baseURL } })`。
 * 智谱/通义等均走 OpenAI SDK 兼容协议，因此统一用 `@langchain/openai` 的 `ChatOpenAI`。
 */
export function createChatModel(
  modelValue: string,
  opts?: CreateChatModelOptions,
): ChatOpenAI {
  const cfg = getModelConfig(modelValue)
  if (!cfg) {
    throw new Error(`Model not found: ${modelValue}`)
  }

  const { apiKey, baseURL } = resolveProviderEnv(cfg.provider)

  return new ChatOpenAI({
    model: modelValue,
    apiKey,
    temperature: opts?.temperature ?? 0.7,
    maxTokens: opts?.maxTokens ?? cfg.maxTokens,
    timeout: 30000,
    maxRetries: 1,
    configuration: { baseURL },
  })
}
