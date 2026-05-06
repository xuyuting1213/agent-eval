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

/** 大区方位词，不能当地名做「结果必须含该词」校验，否则会误匹配「南方长城」等。 */
const VAGUE_MACRO_REGION = new Set([
  "南方",
  "北方",
  "东部",
  "西部",
  "中部",
  "华东",
  "华南",
  "华北",
  "西南",
  "西北",
  "东北",
]);

/**
 * 「南方天气」等大区问法补充权威气象检索词，减少落到具体景点子站（如南方长城）。
 */
function expandVagueMacroRegionWeatherQuery(query: string): string {
  const q = query.trim();
  if (!q || !/[\u4e00-\u9fff]/.test(q)) return q;
  if (!/(天气|气温|温度)/.test(q)) return q;
  if (q.length > 28) return q;
  if (
    /^(南方|北方|东部|西部|中部|华东|华南|华北|西南|西北|东北)(地区)?的?(天气|气温|温度)/.test(
      q,
    ) &&
    !/(气象局|中央气象台|weather\.cma|nmc\.cn)/i.test(q)
  ) {
    return `${q} 中央气象台 区域预报`;
  }
  return q;
}

/**
 * 中文天气类查询若未带地区，补充「中国」等词，减轻 Tavily 偏向英语/美国站点的问题。
 */
function expandWebSearchQueryForRegion(query: string): string {
  const q = query.trim();
  if (!q) return q;
  const hasCjk = /[\u4e00-\u9fff]/.test(q);
  if (!hasCjk) return q;
  const weatherish =
    /(天气|气温|温度|下雨|降雨|雨雪|台风|雾霾|空气|穿什么|forecast)/i.test(q);
  if (!weatherish) return q;
  if (
    /(中国|北京|上海|广州|深圳|天津|重庆|香港|澳门|台湾|省|市|区|县|气象局|中央气象台)/.test(
      q,
    ) ||
    /(weather\.cma|nmc\.cn)/i.test(q)
  ) {
    return q;
  }
  return `${q} 中国 天气预报`;
}

/**
 * 从中文天气类问句里抽出地名片段（如「南通今天天气」→「南通」），用于校验结果相关性。
 */
function extractChinesePlaceHint(query: string): string | null {
  const q = query.trim();
  const m1 = q.match(/^([\u4e00-\u9fff]{2,12}?)(今天|明天|明日|本周|下周|天气|气温)/);
  if (m1?.[1]) {
    const place = m1[1].replace(/的$/u, "");
    if (place.length >= 2 && !VAGUE_MACRO_REGION.has(place)) return place;
  }
  const m2 = q.match(/^(今天|明天|明日)([\u4e00-\u9fff]{2,12}?)(的)?(天气|气温)/);
  if (m2?.[2]) {
    const place = m2[2].replace(/的$/u, "");
    if (place.length >= 2 && !VAGUE_MACRO_REGION.has(place)) return place;
  }
  return null;
}

/** 判断检索结果是否在标题/摘要/链接中出现给定地名。 */
function resultsMentionPlace(
  rows: Array<{ title?: string; content?: string; url?: string }>,
  place: string,
) {
  if (!place) return false;
  return rows.some((r) => {
    const blob = `${r.title || ""} ${r.content || ""} ${r.url || ""}`;
    return blob.includes(place);
  });
}

/** 将更相关的结果排在前面，优先保留含地名的条目。 */
function sortRowsByPlace(
  rows: Array<{ title?: string; content?: string; url?: string; score?: number }>,
  place: string,
) {
  if (!place) return rows;
  return [...rows].sort((a, b) => {
    const hit = (r: typeof a) =>
      `${r.title || ""} ${r.content || ""} ${r.url || ""}`.includes(place) ? 1 : 0;
    const d = hit(b) - hit(a);
    if (d !== 0) return d;
    return Number(b.score || 0) - Number(a.score || 0);
  });
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
          description:
            "要搜索的关键词或问题；用户用中文问天气/新闻时请保留中文并尽量带上地区（如 北京、中国）。",
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
      const effectiveQuery = expandWebSearchQueryForRegion(
        expandVagueMacroRegionWeatherQuery(query),
      );
      const realtime = isRealtimeIntent(effectiveQuery);
      const first = await tavilySearch(apiKey, effectiveQuery, {
        realtime,
        maxResults: 5,
      });
      if (!first.response.ok || first.data?.error) {
        return `搜索失败: ${first.data?.error || first.response.statusText || "未知错误"}`;
      }

      let rows = first.rows;
      let answer = first.data?.answer || "";
      const currentYear = first.now.getFullYear();
      const placeHint = extractChinesePlaceHint(effectiveQuery);
      const localWeatherQuery =
        Boolean(placeHint) && /(天气|气温|温度|下雨|降雨)/.test(effectiveQuery);

      // 实时问题下，若结果几乎都在旧年份，自动二次检索拉回到当前年上下文（本地天气带地名时跳过，避免被英文新闻站带偏）。
      if (
        realtime &&
        allResultsOlderThanCurrentYear(rows, currentYear) &&
        !localWeatherQuery
      ) {
        const boosted = await tavilySearch(
          apiKey,
          `${effectiveQuery} ${currentYear} 最新`,
          { realtime: true, maxResults: 5 },
        );
        if (boosted.response.ok && !boosted.data?.error && boosted.rows.length) {
          rows = boosted.rows;
          answer = boosted.data?.answer || answer;
        }
      }

      // 中文地名 + 天气：若结果完全不提该地名，用国内天气关键词二次检索。
      if (
        placeHint &&
        localWeatherQuery &&
        rows.length > 0 &&
        !resultsMentionPlace(rows, placeHint)
      ) {
        const fallback = await tavilySearch(
          apiKey,
          `${placeHint} 天气预报 中国`,
          { realtime: false, maxResults: 5 },
        );
        if (fallback.response.ok && !fallback.data?.error && fallback.rows.length) {
          rows = sortRowsByPlace(fallback.rows, placeHint);
          answer = fallback.data?.answer || answer;
        }
      } else if (placeHint && rows.length > 0) {
        rows = sortRowsByPlace(rows, placeHint);
      }

      const normalized = {
        query: effectiveQuery,
        originalQuery: query !== effectiveQuery ? query : undefined,
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
