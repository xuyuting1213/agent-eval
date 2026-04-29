import { createChatModel } from '~/server/services/llm';
import { performWebSearch } from '~/server/tools/search';
import { messageContentToString } from '~/server/services/llm';

export default defineEventHandler(async (event) => {
  const { question, model, enableTools } = await readBody(event);

  if (!question) {
    throw createError({ statusCode: 400, message: 'question is required' });
  }

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const modelInstance = createChatModel(model || 'glm-4-flash', {
    // 联网问答场景降低随机性，尽量减少“补全式幻觉”。
    temperature: enableTools !== false ? 0.1 : 0.7,
  });

  const startTime = Date.now();
  const hasToolCall = enableTools !== false;
  let toolCallInfo: { name: string; query: string } | null = null;
  let toolSource: 'mcp' | 'tavily' | 'none' = 'none';

  return sendStream(event, new ReadableStream({
    async start(controller) {
      let fullContent = '';
      let searchResultText = '';

      try {
        /**
         * 统一“先检索再回答”策略：
         * 避免依赖各厂商模型对 tool_calls/function-calling 的兼容差异，
         * 让所有模型都能基于同一份联网上下文回答。
         */
        if (enableTools !== false) {
          toolCallInfo = { name: 'web_search', query: question };
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'tool_call', tool: 'web_search', query: question })}\n\n`,
            ),
          );

          const searchResult = await performWebSearch(question);
          searchResultText = searchResult.content;
          toolSource = searchResult.provider;

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'tool_result', content: searchResultText.slice(0, 200), toolSource })}\n\n`,
            ),
          );
        }

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dateRangeHint = `${sevenDaysAgo.toISOString().slice(0, 10)} ~ ${now
          .toISOString()
          .slice(0, 10)}`;

        const systemPrompt =
          enableTools !== false
            ? [
                '你是一个严格的联网问答助手。',
                '回答必须只基于“联网检索结果”，禁止使用训练记忆或常识自行补充未检索到的事实。',
                '如果检索结果不相关、证据不足或无法验证，请明确回答“未检索到足够可信的信息”。',
                `当前可接受日期范围（最近7天）：${dateRangeHint}。`,
                '若用户要求按日期列出，请仅输出检索结果中可明确识别日期且落在最近7天范围内的条目。',
                '每条必须包含来源链接；没有链接或日期不明确的条目一律不输出。',
                '如果无法满足上述条件，直接输出：未检索到足够可信的信息。',
                '不要输出“行业共识信息/可能原因推测/补充常识性动态”等非检索证据内容。',
                '禁止输出与检索结果不一致的年份（如 2023/2024 的历史事件）来替代最近7天信息。',
                '',
                '[联网检索结果]',
                searchResultText || '无',
              ].join('\n')
            : '你是一个智能助手，请准确、清晰地回答问题。';

        const stream = await modelInstance.stream([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ]);

        for await (const chunk of stream) {
          const content = messageContentToString(chunk.content);
          if (content) {
            fullContent += content;
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`));
          }
        }
        const duration = Date.now() - startTime;
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
          type: 'done', 
          totalTokens: Math.ceil(fullContent.length / 4),
          duration,
          hasToolCall,
          toolCallInfo,
          toolSource
        })}\n\n`));
        controller.close();
      } catch (error) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : '未知错误' })}\n\n`));
        controller.close();
      }
    }
  }));
});