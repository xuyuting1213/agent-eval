/**
 * 服务端 LangChain / OpenAI 兼容工具统一出口；实现细节见各模块与 lib/。
 */
export {
  chinaWeatherNowTool,
  openAiChinaWeatherNowTool,
} from "./chinaWeather";
export {
  fetchApisspaceWeatherNow,
  formatApisspaceWeatherBodyToZh,
} from "./lib/apisspaceWeather";
export { resolveCityToAreacode } from "./lib/chinaWeatherAreacode";
export { searchTool, webSearchOpenAITool } from "./search";
