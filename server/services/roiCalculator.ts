import { getScenario } from "~/server/config/businessScenarios";
import { getModelConfig } from "~/server/config/models";

export interface ROICalculation {
  modelCostPer1KTokens: number;
  totalTokens: number;
  totalModelCost: number;
  humanCostPerTask: number;
  autoRate: number;
  /** 按日均任务量估算的「每日」节省人工成本（美元，未扣模型日成本）。 */
  estimatedSave: number;
  /** (每日节省 − 每日模型估算成本) / 每日模型估算成本 × 100；模型成本极小时 capped。 */
  roi: number;
  paybackDays: number;
  dailyVolume: number;
  monthlySave: number;
  yearlySave: number;
}

/**
 * 从模型配置取美元/千 token 的混合单价（输入+输出均值），未知模型时回退保守值。
 */
function getModelCostPer1KTokens(modelName: string): number {
  const cfg = getModelConfig(modelName);
  if (!cfg) {
    return 0.005;
  }
  return (cfg.costPer1KInput + cfg.costPer1KOutput) / 2;
}

/**
 * 结合单次评测 token、场景人工/自动化假设与日均量，估算模型成本、节省与 ROI 展示指标。
 */
export function calculateROI(
  modelName: string,
  totalTokens: number,
  scenarioId: string,
  options?: {
    dailyVolume?: number;
    autoRate?: number;
    questionCount?: number;
  },
): ROICalculation {
  const scenario = getScenario(scenarioId);
  const dailyVolume = options?.dailyVolume ?? 100;
  const autoRate =
    options?.autoRate ?? scenario?.costBenefit?.autoSaveRatio ?? 0.7;
  const humanCostPerTask =
    scenario?.costBenefit?.avgHumanCostPerTask ?? 2.5;

  const modelCostPer1KTokens = getModelCostPer1KTokens(modelName);
  const totalModelCost = (totalTokens / 1000) * modelCostPer1KTokens;

  const estimatedSavePerTask = humanCostPerTask * autoRate;
  const estimatedSave = estimatedSavePerTask * dailyVolume;

  const n = Math.max(1, options?.questionCount ?? 1);
  const tokensPerTask = totalTokens / n;
  const dailyModelCost =
    (dailyVolume * (tokensPerTask / 1000)) * modelCostPer1KTokens;

  const netDaily = estimatedSave - dailyModelCost;
  const roi =
    dailyModelCost > 1e-9
      ? (netDaily / dailyModelCost) * 100
      : netDaily > 0
        ? 999
        : 0;

  const paybackDays =
    estimatedSave > 1e-9 && totalModelCost > 0
      ? totalModelCost / estimatedSave
      : 999;

  return {
    modelCostPer1KTokens,
    totalTokens,
    totalModelCost,
    humanCostPerTask,
    autoRate,
    estimatedSave,
    roi: Math.min(Math.round(roi * 10) / 10, 999999),
    paybackDays: Math.min(Math.round(paybackDays * 10) / 10, 99999),
    dailyVolume,
    monthlySave: estimatedSave * 30,
    yearlySave: estimatedSave * 365,
  };
}
