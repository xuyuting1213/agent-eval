import { createChatModel } from '~/server/services/llm';
import { searchTool } from '~/server/tools/search';

export interface ToolCallResult {
  content: string;
  toolCalls?: Array<{ name: string; query: string }>;
}

export async function chatWithTools(
  question: string,
  modelName: string,
  enableTools: boolean = true
): Promise<ToolCallResult> {
  const model = createChatModel(modelName, { temperature: 0.7 });
  
  // 绑定工具
  const modelWithTools = enableTools ? model.bindTools([searchTool]) : model;
  
  const response = await modelWithTools.invoke([
    { role: 'system', content: '你是一个智能助手。当需要最新信息时，请使用 web_search 工具搜索。回答要准确、有帮助。' },
    { role: 'user', content: question }
  ]);
  
  // 检查是否有工具调用
  const toolCalls: Array<{ name: string; query: string }> = [];
  let finalContent = response.content as string;
  
  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      if (toolCall.name === 'web_search') {
        const args = toolCall.args as { query: string };
        toolCalls.push({ name: 'web_search', query: args.query });
        
        // 执行搜索
        const searchResult = await searchTool.invoke({ query: args.query });
        finalContent += `\n\n[搜索结果]\n${searchResult}`;
      }
    }
  }
  
  return {
    content: finalContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

// 批量调用（带工具）
export async function batchChatWithTools(
  questions: string[],
  modelName: string,
  concurrency: number = 3
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = [];
  
  for (let i = 0; i < questions.length; i += concurrency) {
    const batch = questions.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(q => chatWithTools(q, modelName, true))
    );
    results.push(...batchResults);
  }
  
  return results;
}