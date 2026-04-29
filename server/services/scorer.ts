// 评分服务 — LangChain Prompt + 调用后 Zod 校验（兼容智谱等返回 ```json 包裹的情况）
import { ChatPromptTemplate } from '@langchain/core/prompts'
import type { AIMessage } from '@langchain/core/messages'
import { RunnableLambda } from '@langchain/core/runnables'
import { z } from 'zod'
import { createChatModel, messageContentToString } from '~/server/services/llm'

const ScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string(),
  dimensions: z.object({
    accuracy: z.number(),
    completeness: z.number(),
    relevance: z.number(),
    clarity: z.number(),
  }),
})

const scoringPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一个严格的 AI 答案评估专家。根据用户给出的问题和答案，只输出一个 JSON 对象（不要 markdown、不要用代码围栏、不要其它说明文字）。
字段：score(number 0-100)、reasoning(string)、dimensions(object，含 accuracy/completeness/relevance/clarity，各 0-100)。
综合评分(score) 应体现：准确性×40% + 完整性×25% + 相关性×20% + 清晰度×15%。`,
  ],
  [
    'human',
    `【问题】
{question}

【答案】
{answer}`,
  ],
])

const scorerModelId = 'glm-4-flash'

export interface ScoreResult {
  score: number
  reasoning: string
  dimensions: {
    accuracy: number
    completeness: number
    relevance: number
    clarity: number
  }
}

function emptyScore(reasoning: string): ScoreResult {
  return {
    score: 0,
    reasoning,
    dimensions: {
      accuracy: 0,
      completeness: 0,
      relevance: 0,
      clarity: 0,
    },
  }
}

/** 去掉 ```json ... ``` 等包裹，截取第一个 JSON 对象再解析 */
function extractJsonObjectText(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return s.slice(start, end + 1)
  }
  return s
}

function parseScoreFromAiMessage(msg: AIMessage): ScoreResult {
  try {
    const text = messageContentToString(msg.content)
    const jsonText = extractJsonObjectText(text)
    const parsed = ScoreSchema.safeParse(JSON.parse(jsonText))
    if (!parsed.success) {
      return emptyScore('评分格式无效')
    }
    return parsed.data
  } catch (e) {
    return emptyScore(
      '评分解析失败：' +
        (e instanceof Error ? e.message : '未知错误'),
    )
  }
}

function createScoringChain() {
  const llm = createChatModel(scorerModelId, { temperature: 0.3 })
  return scoringPrompt
    .pipe(llm)
    .pipe(
      RunnableLambda.from((msg: AIMessage) => parseScoreFromAiMessage(msg)),
    )
}

export async function scoreAnswer(
  question: string,
  answer: string,
): Promise<ScoreResult> {
  try {
    const chain = createScoringChain()
    return await chain.invoke({ question, answer })
  } catch (error) {
    console.error('评分调用失败:', error)
    return emptyScore(
      '评分失败：' +
        (error instanceof Error ? error.message : '未知错误'),
    )
  }
}

export async function batchScore(
  qaList: Array<{ question: string; answer: string }>,
  concurrency: number = 3,
): Promise<ScoreResult[]> {
  const chain = createScoringChain()
  const inputs = qaList.map(({ question, answer }) => ({
    question,
    answer,
  }))

  try {
    return await chain.batch(inputs, {
      maxConcurrency: concurrency,
    })
  } catch (error) {
    console.error('批量评分 batch 失败，回退逐条评分:', error)
    return await Promise.all(
      qaList.map(({ question, answer }) => scoreAnswer(question, answer)),
    )
  }
}
