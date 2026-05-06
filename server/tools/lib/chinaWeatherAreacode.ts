/**
 * 中国天气网风格城市代码（areacode），供 APISpace 实况接口使用；未收录城市可传 areacode 直查。
 */
const CITY_TO_AREACODE: Record<string, string> = {
  北京: "101010100",
  北京市: "101010100",
  上海: "101020100",
  上海市: "101020100",
  天津: "101030100",
  重庆市: "101040100",
  重庆: "101040100",
  广州: "101280101",
  深圳: "101280601",
  杭州: "101210101",
  南京: "101190101",
  苏州: "101190401",
  无锡: "101190201",
  南通: "101190501",
  成都: "101270101",
  武汉: "101200101",
  西安: "101110101",
  郑州: "101180101",
  济南: "101120101",
  青岛: "101120201",
  沈阳: "101070101",
  大连: "101070201",
  哈尔滨: "101050101",
  厦门: "101230201",
  福州: "101230101",
  合肥: "101220101",
  南昌: "101240101",
  长沙: "101250101",
  昆明: "101290101",
  南宁: "101300101",
  海口: "101310101",
  石家庄: "101090101",
  太原: "101100101",
  长春: "101060101",
  乌鲁木齐: "101130101",
  拉萨: "101140101",
  银川: "101170101",
  西宁: "101150101",
  呼和浩特: "101080101",
  香港: "101320101",
  澳门: "101330101",
  台北: "101340101",
};

/**
 * 将用户输入的城市名解析为 areacode；去掉常见后缀后查表。
 */
export function resolveCityToAreacode(city: string): string | null {
  const raw = city.trim();
  if (!raw) return null;
  if (/^\d{9}$/.test(raw)) return raw;
  const stripped = raw.replace(/(市|县|区|自治州|地区)$/u, "");
  return CITY_TO_AREACODE[raw] || CITY_TO_AREACODE[stripped] || null;
}

/**
 * 从自然语言里匹配内置城市表（长名优先），供模型误传 query 时解析出 city。
 */
export function extractKnownCityFromQuestion(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const keys = [...new Set(Object.keys(CITY_TO_AREACODE))].sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keys) {
    if (!trimmed.includes(key)) continue;
    const base = key.replace(/市$/u, "");
    if (resolveCityToAreacode(key) || resolveCityToAreacode(base)) {
      return base.length >= 2 ? base : key;
    }
  }
  return null;
}
