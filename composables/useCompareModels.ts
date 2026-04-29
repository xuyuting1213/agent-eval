export interface CompareModelOption {
  value: string;
  name: string;
  desc: string;
  costPer1KInput: number;
  costPer1KOutput: number;
}

export const zhipuModels: CompareModelOption[] = [
  { value: "glm-4-flash", name: "GLM-4-Flash", desc: "快速响应，成本极低，适合高频调用", costPer1KInput: 0.0006, costPer1KOutput: 0.0006 },
  { value: "glm-4-plus", name: "GLM-4-Plus", desc: "最强大脑，复杂推理，成本较高", costPer1KInput: 0.05, costPer1KOutput: 0.05 },
  { value: "glm-4-air", name: "GLM-4-Air", desc: "平衡性价比，适中速度", costPer1KInput: 0.005, costPer1KOutput: 0.005 },
  { value: "glm-4-long", name: "GLM-4-Long", desc: "超长上下文 1M tokens，适合处理长文档", costPer1KInput: 0.005, costPer1KOutput: 0.005 },
  { value: "glm-3-turbo", name: "GLM-3-Turbo", desc: "经济实惠，简单任务专用", costPer1KInput: 0.001, costPer1KOutput: 0.001 },
];

export const openaiModels: CompareModelOption[] = [
  { value: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", desc: "快速响应，成本较低", costPer1KInput: 0.0005, costPer1KOutput: 0.0015 },
  { value: "gpt-4-turbo", name: "GPT-4 Turbo", desc: "强大，适合复杂任务", costPer1KInput: 0.01, costPer1KOutput: 0.03 },
  { value: "gpt-4o", name: "GPT-4o", desc: "多模态，最新最强", costPer1KInput: 0.005, costPer1KOutput: 0.015 },
];

export const qwenModels: CompareModelOption[] = [
  { value: "qwen-turbo", name: "Qwen-Turbo", desc: "快速响应", costPer1KInput: 0.002, costPer1KOutput: 0.002 },
  { value: "qwen-plus", name: "Qwen-Plus", desc: "平衡性价比", costPer1KInput: 0.004, costPer1KOutput: 0.006 },
];

/**
 * 统一模型目录：供横评页做展示、勾选和结果名映射，避免页面维护重复常量。
 */
export const useCompareModels = () => {
  const allModels = [...zhipuModels, ...openaiModels, ...qwenModels];

  /**
   * 将模型 id 映射为可读名称；当找不到时回退原始 id，避免 UI 空白。
   */
  const getModelDisplayName = (modelValue: string) => {
    const model = allModels.find((m) => m.value === modelValue);
    return model?.name || modelValue;
  };

  return {
    zhipuModels,
    openaiModels,
    qwenModels,
    allModels,
    getModelDisplayName,
  };
};
