import { tool } from "@langchain/core/tools";
import { z } from "zod";

function getServerNowPayload() {
  const now = new Date();
  const tz = process.env.SEARCH_TZ || "Asia/Shanghai";
  const zh = new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return { timezone: tz, iso: now.toISOString(), zh };
}

function isRealtimeIntent(query: string) {
  return /(今天|当前|现在|最新|近一周|最近|实时|新闻|快讯|日期|几号|本周|本月|本年|今年)/i.test(
    query,
  );
}

function extractMentionedYears(text: string) {
  const years = text.match(/\b(19|20)\d{2}\b/g) || [];
  return years.map((y) => Number(y));
}

function allResultsOlderThanCurrentYear(
  rows: Array<{ title?: string; content?: string; url?: string }>,
  currentYear: number,
) {
  if (!rows.length) return false;
  const rowYears = rows.flatMap((r) =>
    extractMentionedYears(`${r.title || ""} ${r.content || ""} ${r.url || ""}`),
  );
  if (!rowYears.length) return false;
  return rowYears.every((y) => y < currentYear);
}

async function tavilySearch(
  apiKey: string,
  query: string,
  opts?: { realtime?: boolean; maxResults?: number },
) {
  const now = new Date();
  const body: Record<string, unknown> = {
    query,
    include_answer: true,
    max_results: opts?.maxResults ?? 5,
    search_depth: opts?.realtime ? "advanced" : "basic",
  };
  if (opts?.realtime) {
    body.topic = "news";
    body.days = 14;
  }

  // 某些 Tavily 账户/版本可能不支持 topic/days，失败时自动回退基础参数。
  let response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  let data = await response.json();

  if (!response.ok || data?.error) {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        include_answer: true,
        max_results: opts?.maxResults ?? 5,
        search_depth: "basic",
      }),
    });
    data = await response.json();
  }

  const rows = Array.isArray(data?.results)
    ? data.results.slice(0, opts?.maxResults ?? 5).map((item: any) => ({
        title: item?.title || "",
        content: String(item?.content || "").slice(0, 320),
        score: Number(item?.score || 0),
        url: item?.url || "",
      }))
    : [];

  return {
    response,
    data,
    rows,
    now,
  };
}

/**
 * 智谱 / 通义等兼容接口对 Zod→JSON Schema 的扩展字段较敏感，绑定工具时用最小 OpenAI function 定义更稳。
 */
export const webSearchOpenAITool = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "搜索互联网获取最新信息。用户问实时资讯、新闻、天气、股价等需要联网时使用。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "要搜索的关键词或问题",
        },
      },
      required: ["query"],
    },
  },
};

/**
 * 联网搜索工具（Tavily）：
 * - 返回结构化 JSON 字符串（answer/results/score/url），便于不同模型公平使用同一外部证据。
 * - 限制 max_results 和内容长度，避免 token 激增影响横评成本。
 */
export const searchTool = tool(
  async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "搜索功能未配置，请设置 TAVILY_API_KEY 环境变量";
    }

    try {
      const realtime = isRealtimeIntent(query);
      const first = await tavilySearch(apiKey, query, {
        realtime,
        maxResults: 5,
      });
      if (!first.response.ok || first.data?.error) {
        return `搜索失败: ${first.data?.error || first.response.statusText || "未知错误"}`;
      }

      let rows = first.rows;
      let answer = first.data?.answer || "";
      const currentYear = first.now.getFullYear();

      // 实时问题下，若结果几乎都在旧年份，自动二次检索拉回到当前年上下文。
      if (realtime && allResultsOlderThanCurrentYear(rows, currentYear)) {
        const boosted = await tavilySearch(
          apiKey,
          `${query} ${currentYear} 最新`,
          { realtime: true, maxResults: 5 },
        );
        if (boosted.response.ok && !boosted.data?.error && boosted.rows.length) {
          rows = boosted.rows;
          answer = boosted.data?.answer || answer;
        }
      }

      const normalized = {
        query,
        serverNow: getServerNowPayload(),
        answer,
        results: rows.slice(0, 5),
      };
      return JSON.stringify(normalized);
    } catch (error) {
      console.error("搜索失败:", error);
      return `搜索失败: ${error instanceof Error ? error.message : "未知错误"}`;
    }
  },
  {
    name: "web_search",
    description:
      "搜索互联网获取最新、最准确的信息。当用户询问实时信息、新闻、天气、股票等需要最新数据的问题时使用。",
    schema: z.object({
      query: z.string().describe("要搜索的关键词或问题"),
    }),
  },
);
