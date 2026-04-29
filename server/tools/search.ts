import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

interface McpJsonRpcResponse<T = unknown> {
  result?: T;
  error?: { message?: string };
}

let cachedMcpSessionId: string | null = null;
let mcpSessionInitialized = false;

export type SearchProvider = 'mcp' | 'tavily' | 'none';

export interface SearchExecutionResult {
  content: string;
  provider: SearchProvider;
}

function isNewsIntent(query: string): boolean {
  return /(近一周|最近|本周|新闻|动态|大事|发布|融资|开源)/i.test(query);
}

function isAiIntent(query: string): boolean {
  return /(ai|人工智能|大模型|llm|openai|anthropic|gemini|deepmind|通义|智谱|qwen|gpt|claude|agent)/i.test(
    query,
  );
}

function buildSearchQueries(query: string): string[] {
  const normalized = query.trim();
  const seeds: string[] = [];
  const hintKeywords = /(近一周|最近|本周|AI|人工智能|大事|新闻|动态)/i;
  if (hintKeywords.test(normalized)) {
    seeds.push('AI 行业 新闻 最近一周 发布 融资 开源');
    seeds.push('AI 行业 最新新闻 最近一周');
    seeds.push('人工智能 大模型 发布 融资 开源 近7天');
    seeds.push('OpenAI Anthropic Google DeepMind 阿里 通义 智谱 近一周');
    seeds.push('AI 新闻 site:36kr.com OR site:jiqizhixin.com OR site:leiphone.com OR site:cls.cn 近7天');
    seeds.push('AI news site:techcrunch.com OR site:theverge.com OR site:reuters.com past week');
  }
  seeds.push(normalized);
  return Array.from(new Set(seeds));
}

function formatMcpText(raw: string): string {
  const text = raw.trim();
  if (!text) return text;

  // 一些 MCP 工具会把 JSON 直接作为文本返回，先提炼成结构化摘要给模型。
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const jsonLike = text.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(jsonLike) as {
        query?: string;
        results?: Array<{ title?: string; url?: string; snippet?: string; content?: string }>;
      };
      if (Array.isArray(parsed.results) && parsed.results.length > 0) {
        const top = parsed.results.slice(0, 8);
        const lines = top.map((item, idx) => {
          const snippet = (item.snippet || item.content || '').slice(0, 120);
          return `${idx + 1}. ${item.title || '无标题'}\n   链接: ${item.url || '无'}\n   摘要: ${snippet || '无'}`;
        });
        return `搜索词: ${parsed.query || '未知'}\n\n检索结果:\n${lines.join('\n\n')}`;
      }
    } catch {
      // ignore json parse errors and fallback to raw text
    }
  }
  return text;
}

function isAiRelatedText(input: string): boolean {
  const text = input.toLowerCase();
  const keywords = [
    'ai',
    '人工智能',
    '大模型',
    'llm',
    'openai',
    'anthropic',
    'gemini',
    'deepmind',
    '通义',
    '智谱',
    'qwen',
    'gpt',
    'claude',
    'agent',
  ];
  return keywords.some((k) => text.includes(k));
}

function mcpResultLooksRelevant(raw: string, userQuery: string): boolean {
  const text = raw.trim();
  if (!text) return false;

  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) return false;

  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
      results?: Array<{ title?: string; snippet?: string; content?: string; url?: string }>;
    };
    const rows = parsed.results || [];
    if (rows.length === 0) return false;
    if (rows.length < 3) return false;

    const lowQualitySource =
      /(zhidao\.baidu\.com|baike\.baidu\.com|wenwen\.sogou\.com|zhihu\.com\/question|chsi\.com\.cn|edu\.cn)/i;
    const trustedNewsSource =
      /(36kr\.com|jiqizhixin\.com|leiphone\.com|huxiu\.com|reuters\.com|techcrunch\.com|theverge\.com|bloomberg\.com|wsj\.com|ft\.com|cnbeta\.com|infoq\.cn|geekpark\.net|nytimes\.com)/i;
    const relevantCount = rows.filter((item) =>
      isAiRelatedText(
        `${item.title || ''} ${item.snippet || ''} ${item.url || ''}`,
      ),
    ).length;
    const lowQualityCount = rows.filter((item) =>
      lowQualitySource.test(`${item.url || ''}`),
    ).length;
    const trustedCount = rows.filter((item) =>
      trustedNewsSource.test(`${item.url || ''}`),
    ).length;
    const aiLike = isAiIntent(userQuery);
    const passGeneric = lowQualityCount / rows.length <= 0.7;
    const passAi = relevantCount >= 2 && relevantCount / rows.length >= 0.4;
    if (!passGeneric) return false;
    if (aiLike && !passAi) return false;

    // 新闻类问题额外要求至少命中 1 条可信新闻域名，避免检索落到问答/百科站点。
    if (isNewsIntent(userQuery) && aiLike && trustedCount < 1) {
      return false;
    }

    return true;
  } catch {
    // ignore parse error
  }

  // 非 JSON 文本结果：AI 问题要求包含 AI 关键词；普通问题接受非空文本。
  return isAiIntent(userQuery) ? isAiRelatedText(text) : text.length > 20;
}

/**
 * 优先读取运行时环境变量，其次从 `.cursor/mcp.json` 自动发现 ModelScope MCP 地址。
 */
async function resolveModelScopeMcpUrl(): Promise<string | null> {
  if (process.env.MODELSCOPE_MCP_URL?.trim()) {
    return process.env.MODELSCOPE_MCP_URL.trim();
  }
  try {
    const raw = await fs.readFile(join(process.cwd(), '.cursor/mcp.json'), 'utf-8');
    const parsed = JSON.parse(raw) as {
      mcpServers?: Record<string, { url?: string }>;
    };
    const url =
      parsed.mcpServers?.search?.url ||
      parsed.mcpServers?.fetch?.url ||
      Object.values(parsed.mcpServers || {})
        .map((item) => item?.url || '')
        .find((item) => Boolean(item));
    return typeof url === 'string' && url.trim() ? url.trim() : null;
  } catch {
    return null;
  }
}

/**
 * 尝试通过 MCP 的 tools/call 执行联网搜索。
 * 如果目标 MCP 不兼容当前调用方式，会抛错并由上层自动降级到 Tavily。
 */
async function searchViaModelScopeMcp(query: string): Promise<string> {
  const mcpUrl = await resolveModelScopeMcpUrl();
  if (!mcpUrl) {
    throw new Error('MODELSCOPE MCP URL is not configured');
  }

  /**
   * 向 MCP 端点发送 JSON-RPC 请求：
   * - 已有会话时自动携带 `mcp-session-id`
   * - 初始化响应若回传新 session id，会更新缓存
   */
  const mcpRequest = async <T>(
    method: string,
    params: Record<string, unknown>,
    withSession: boolean,
  ) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (withSession && cachedMcpSessionId) {
      headers['mcp-session-id'] = cachedMcpSessionId;
    }

    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    const sessionFromResponse = response.headers.get('mcp-session-id');
    if (sessionFromResponse) {
      cachedMcpSessionId = sessionFromResponse;
    }

    const payload = (await response.json()) as McpJsonRpcResponse<T>;
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message || `MCP ${method} failed (${response.status})`);
    }
    return payload;
  };

  /**
   * MCP 规范要求 initialize 后发送 initialized 通知；部分服务端未收到通知会拒绝 tools/call。
   */
  const sendInitializedNotification = async () => {
    if (!cachedMcpSessionId || mcpSessionInitialized) return;
    await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': cachedMcpSessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      }),
    });
    mcpSessionInitialized = true;
  };

  /**
   * 建立 MCP 会话：服务端要求先 initialize，后续请求必须带 `mcp-session-id`。
   */
  const ensureMcpSession = async () => {
    if (cachedMcpSessionId && mcpSessionInitialized) return;

    if (!cachedMcpSessionId) {
      await mcpRequest(
        'initialize',
        {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'nuxt3-ts-app',
            version: '1.0.0',
          },
        },
        false,
      );
      mcpSessionInitialized = false;
    }

    await sendInitializedNotification();
  };

  const callTool = async (name: string, args: Record<string, unknown>) => {
    await ensureMcpSession();
    const payload = await mcpRequest<{
      content?: Array<{ type?: string; text?: string }>;
      isError?: boolean;
    }>('tools/call', { name, arguments: args }, true);

    if (payload.result?.isError) {
      const errorText = payload.result?.content
        ?.map((item) => item?.text || '')
        .join('\n')
        .trim();
      throw new Error(errorText || `MCP tool ${name} returned isError`);
    }

    const text = payload.result?.content
      ?.map((item) => item?.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
    const finalText = text || 'MCP 返回为空';
    if (!mcpResultLooksRelevant(finalText, query)) {
      throw new Error('MCP result is not relevant enough');
    }
    return formatMcpText(finalText);
  };

  /**
   * 先拉取服务端实际支持的工具，再按工具类型构造参数：
   * - 支持 web_search/search：传 query
   * - 仅支持 fetch：传可抓取的搜索 RSS URL（带近 7 天约束）
   */
  await ensureMcpSession();
  const toolsPayload = await mcpRequest<{
    tools?: Array<{ name?: string }>;
  }>('tools/list', {}, true);
  const toolNames = new Set(
    (toolsPayload.result?.tools || [])
      .map((t) => t.name || '')
      .filter(Boolean),
  );

  const candidates: Array<{ name: string; args: Record<string, unknown> }> = [];
  const queryVariants = buildSearchQueries(query);
  if (toolNames.has('bing_search')) {
    queryVariants.forEach((q) => {
      candidates.push({ name: 'bing_search', args: { query: q, count: 10, offset: 0 } });
    });
  }
  if (toolNames.has('web_search')) {
    queryVariants.forEach((q) => {
      candidates.push({ name: 'web_search', args: { query: q } });
    });
  }
  if (toolNames.has('search')) {
    queryVariants.forEach((q) => {
      candidates.push({ name: 'search', args: { query: q } });
    });
  }
  if (toolNames.has('fetch')) {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    candidates.push({
      name: 'fetch',
      args: {
        url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${sevenDaysAgo}`,
      },
    });
    candidates.push({
      name: 'fetch',
      args: {
        url: `https://news.ycombinator.com/rss`,
      },
    });
  }
  if (candidates.length === 0) {
    throw new Error('MCP server has no usable search tools');
  }

  let lastError = '';
  for (const candidate of candidates) {
    try {
      return await callTool(candidate.name, candidate.args);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // 会话失效时清理并允许下一轮重建。
      if (lastError.includes('mcp-session-id')) {
        cachedMcpSessionId = null;
        mcpSessionInitialized = false;
      }
    }
  }
  throw new Error(lastError || 'MCP search failed');
}

export const searchTool = tool(
  async ({ query }) => {
    const result = await performWebSearch(query);
    return result.content;
  },
  {
    name: 'web_search',
    description: '搜索互联网获取最新、最准确的信息。当用户询问实时信息、新闻、天气、股票等需要最新数据的问题时使用。',
    schema: z.object({
      query: z.string().describe('要搜索的关键词或问题'),
    }),
  }
);

/**
 * 统一联网搜索入口：优先 MCP，失败后降级 Tavily。
 * 返回 provider 供上层在 UI 标注「是否命中 MCP」。
 */
export async function performWebSearch(query: string): Promise<SearchExecutionResult> {
  // 优先走 MCP 联网，确保不同模型得到同一份外部信息上下文。
  try {
    const mcpResult = await searchViaModelScopeMcp(query);
    return {
      provider: 'mcp',
      content: `搜索关键词: ${query}\n\n🔍 MCP 搜索结果:\n${mcpResult}`,
    };
  } catch (mcpError) {
    console.warn('MCP 搜索失败，降级 Tavily:', mcpError);
  }

  // MCP 不可用时降级到 Tavily，避免主流程被外部依赖中断。
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      provider: 'none',
      content: '联网搜索未配置：请设置 MODELSCOPE_MCP_URL（或 .cursor/mcp.json）/ TAVILY_API_KEY',
    };
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      return {
        provider: 'tavily',
        content: `搜索失败: ${data.error}`,
      };
    }

    // 格式化搜索结果
    let result = `搜索关键词: ${query}\n\n`;
    
    if (data.answer) {
      result += `📝 智能回答: ${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      result += `🔍 搜索结果:\n`;
      data.results.forEach((item: any, idx: number) => {
        result += `${idx + 1}. ${item.title}\n`;
        result += `   ${item.content.slice(0, 300)}${item.content.length > 300 ? '...' : ''}\n`;
        result += `   来源: ${item.url}\n\n`;
      });
    }
    
    return {
      provider: 'tavily',
      content: result,
    };
  } catch (error) {
    console.error('搜索失败:', error);
    return {
      provider: 'tavily',
      content: `搜索失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}