import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { fetchApisspaceWeatherNow } from "~/server/tools/lib/apisspaceWeather";
import { resolveCityToAreacode } from "~/server/tools/lib/chinaWeatherAreacode";

/**
 * 智谱 / 通义绑定工具用最小 OpenAI function 定义。
 */
export const openAiChinaWeatherNowTool = {
  type: "function" as const,
  function: {
    name: "china_weather_now",
    description:
      "查询中国城市当前实况天气（APISpace）。问「北京现在天气」「南通气温」等优先使用；需服务端配置 Token。可只填 city，或只填 areacode（如 101010100）。",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "城市名，如 北京、南通" },
        areacode: {
          type: "string",
          description: "可选，中国天气网风格 9 位城市代码，如北京 101010100",
        },
      },
    },
  },
};

const chinaWeatherSchema = z
  .object({
    city: z.string().optional(),
    areacode: z.string().optional(),
  })
  .refine((d) => Boolean(d.city?.trim() || d.areacode?.trim()), {
    message: "city 与 areacode 至少填一个",
  });

/**
 * 中国城市实况天气工具：解析城市或 areacode 后请求 APISpace，返回 JSON 字符串供模型消费。
 */
export const chinaWeatherNowTool = tool(
  async (input) => {
    const { city, areacode } = chinaWeatherSchema.parse(input);
    const code =
      areacode?.trim() ||
      (city?.trim() ? resolveCityToAreacode(city.trim()) : null);
    if (!code) {
      return JSON.stringify({
        provider: "apispace",
        ok: false,
        error: "无法解析城市代码，请传常见城市名或明确 areacode（9 位数字）",
        city: city || null,
      });
    }
    const r = await fetchApisspaceWeatherNow(code);
    return JSON.stringify({
      provider: "apispace",
      ok: r.ok,
      areacode: code,
      city: city?.trim() || null,
      httpStatus: r.status,
      raw: r.body.slice(0, 8000),
    });
  },
  {
    name: "china_weather_now",
    description:
      "查询中国城市当前实况天气（APISpace）。优先于泛化联网搜索；支持 city 或 areacode。",
    schema: chinaWeatherSchema,
  },
);
