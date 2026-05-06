/**
 * 调用 APISpace 天气实况（与官方示例一致：GET + query areacode + X-APISpace-Token）。
 * Token 必须来自环境变量，勿写入仓库。
 */
export async function fetchApisspaceWeatherNow(areacode: string): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  const token = process.env.APISPACE_WEATHER_TOKEN;
  const baseUrl =
    process.env.APISPACE_WEATHER_URL ||
    "https://eolink.o.apispace.com/456456/weather/v001/now";
  if (!token) {
    return {
      ok: false,
      status: 0,
      body: JSON.stringify({
        error: "未配置 APISPACE_WEATHER_TOKEN，请在 .env 中设置后重启服务",
      }),
    };
  }
  const url = new URL(baseUrl);
  url.searchParams.set("areacode", areacode.trim());
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "X-APISpace-Token": token },
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/** APISpace 实况 JSON 结构（按需扩展字段）。 */
interface ApisspaceWeatherPayload {
  status?: number;
  msg?: string;
  result?: {
    last_update?: string;
    location?: {
      areacode?: string;
      name?: string;
      country?: string;
      path?: string;
    };
    realtime?: {
      text?: string;
      code?: string;
      temp?: number;
      feels_like?: number;
      rh?: number;
      wind_class?: string;
      wind_speed?: number;
      wind_dir?: string;
      prec?: number;
      prec_time?: string;
      clouds?: number;
      vis?: number;
      pressure?: number;
      brief?: string;
      detail?: string;
    };
  };
}

/**
 * 将 APISpace 返回的 JSON 正文格式化为中文多行摘要，供流式 tool_result 与前端阅读。
 */
export function formatApisspaceWeatherBodyToZh(rawBody: string): string {
  const trimmed = rawBody.trim();
  if (!trimmed) return "无正文";
  try {
    const data = JSON.parse(trimmed) as ApisspaceWeatherPayload;
    if (data.status != null && data.status !== 0) {
      return data.msg || `接口返回 status=${data.status}`;
    }
    const loc = data.result?.location;
    const rt = data.result?.realtime;
    const last = data.result?.last_update;
    if (!rt && !loc) return trimmed.slice(0, 1200);
    const visKm =
      typeof rt?.vis === "number" ? `${Math.round(rt.vis / 1000)} km` : "-";
    const lines: string[] = [];
    if (loc?.name || loc?.path) {
      lines.push(`地点：${loc?.name || "-"}${loc?.path ? `（${loc.path}）` : ""}`);
    }
    if (rt) {
      lines.push(
        `天气：${rt.text ?? "-"}（代码 ${rt.code ?? "-"}），气温 ${rt.temp ?? "-"}℃（体感 ${rt.feels_like ?? "-"}℃）`,
      );
      lines.push(
        `湿度 ${rt.rh ?? "-"}%，${rt.wind_dir ?? "-"} ${rt.wind_class ?? "-"}（风速约 ${rt.wind_speed ?? "-"} m/s）`,
      );
      if (rt.pressure != null) {
        lines.push(`气压 ${rt.pressure} hPa，能见度 ${visKm}`);
      }
      if (rt.prec != null && rt.prec > 0) {
        lines.push(
          `降水 ${rt.prec}${rt.prec_time ? `，观测 ${rt.prec_time}` : ""}`,
        );
      }
      if (rt.brief || rt.detail) {
        lines.push(`提示：${[rt.brief, rt.detail].filter(Boolean).join("；")}`);
      }
    }
    if (last) lines.push(`数据更新：${last}`);
    return lines.join("\n");
  } catch {
    return trimmed.slice(0, 1200);
  }
}
