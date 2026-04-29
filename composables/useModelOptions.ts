export interface ModelOption {
  value: string;
  name: string;
  desc: string;
}

export const modelOptions: ModelOption[] = [
  { value: "glm-4-flash", name: "GLM-4-Flash", desc: "题量多、要快速出结果时更合适" },
  { value: "glm-4-plus", name: "GLM-4-Plus", desc: "效果更强，适合复杂问题" },
  { value: "glm-4-air", name: "GLM-4-Air", desc: "性能和成本更均衡" },
  { value: "glm-4-long", name: "GLM-4-Long", desc: "支持超长上下文任务" },
  { value: "glm-3-turbo", name: "GLM-3-Turbo", desc: "经济实惠，适合日常问答" },
  { value: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", desc: "响应快、成本低" },
  { value: "gpt-4-turbo", name: "GPT-4 Turbo", desc: "复杂推理能力更强" },
  { value: "gpt-4o", name: "GPT-4o", desc: "多模态能力，综合表现强" },
  { value: "qwen-turbo", name: "Qwen-Turbo", desc: "通义快速模型" },
  { value: "qwen-plus", name: "Qwen-Plus", desc: "通义平衡模型" },
  { value: "qwen-max", name: "Qwen-Max", desc: "通义高性能模型" },
];
