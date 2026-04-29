import { getModelStream } from '~/server/services/stream'

export default defineEventHandler(async (event) => {
  const { question, model } = await readBody(event)

  if (!question) {
    throw createError({
      statusCode: 400,
      message: 'question is required'
    })
  }

  // 设置 SSE 响应头
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  const stream = await getModelStream(model || 'glm-4-flash', question)

  return sendStream(event, new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  }))
})