import { createChatModel, messageContentToString, usageFromAiMessage } from '~/server/services/llm'

export interface StreamChunk {
  type: 'content' | 'done' | 'error'
  content?: string
  error?: string
  totalTokens?: number
  duration?: number
  promptTokens?: number
  completionTokens?: number
}

export async function getModelStream(
  modelValue: string,
  question: string
): Promise<AsyncIterable<StreamChunk>> {
  const model = createChatModel(modelValue)
  const startTime = Date.now()

  try {
    // LangChain 流式调用
    const stream = await model.stream([
      { role: 'system', content: '你是一个专业的 AI 助手，请准确、清晰地回答问题。' },
      { role: 'user', content: question }
    ])

    return {
      async *[Symbol.asyncIterator]() {
        let fullContent = ''
        let finalMessage: any = null

        for await (const chunk of stream) {
          finalMessage = chunk
          const content = messageContentToString(chunk.content)
          if (content) {
            fullContent += content
            yield { type: 'content', content }
          }
        }

        const duration = Date.now() - startTime
        
        if (finalMessage) {
          const usage = usageFromAiMessage(finalMessage)
          yield {
            type: 'done',
            totalTokens: usage.totalTokens,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            duration
          }
        } else {
          const totalTokens = Math.ceil(fullContent.length / 4)
          yield {
            type: 'done',
            totalTokens,
            duration
          }
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return {
      async *[Symbol.asyncIterator]() {
        yield { type: 'error', error: errorMessage }
      }
    }
  }
}