export interface BusinessScenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  testSetQuestions?: string[];
  weight: {
    accuracy: number;
    completeness: number;
    relevance: number;
    clarity: number;
    empathy?: number;
    compliance?: number;
    calculation?: number;
  };
  recommendedTools: string[];
  successCriteria: string;
  costBenefit?: {
    avgHumanCostPerTask: number;
    autoSaveRatio: number;
  };
}

export const businessScenarios: Record<string, BusinessScenario> = {
  customerService: {
    id: "customerService",
    name: "智能客服",
    description: "售后咨询、退换货政策、投诉处理",
    icon: "💬",
    testSetQuestions: [
      "我想退货，已经超过7天了还能退吗？",
      "你们的产品有保修吗？保修期多久？",
      "我的订单显示已签收但我没收到，怎么办？",
    ],
    weight: {
      accuracy: 0.4,
      completeness: 0.2,
      relevance: 0.15,
      clarity: 0.1,
      empathy: 0.15,
    },
    recommendedTools: ["web_search", "knowledge_base"],
    successCriteria: "能否正确引导用户解决问题且不产生负面情绪",
    costBenefit: {
      avgHumanCostPerTask: 2.5,
      autoSaveRatio: 0.7,
    },
  },
  documentAnalysis: {
    id: "documentAnalysis",
    name: "合同审查",
    description: "抽取关键条款、对比版本差异、风险提示",
    icon: "📄",
    testSetQuestions: [
      "这份合同中的违约责任条款是什么？",
      "对比这两个版本，有哪些关键变化？",
      "合同中是否有对乙方不利的条款？",
    ],
    weight: {
      accuracy: 0.4,
      completeness: 0.3,
      relevance: 0.15,
      clarity: 0.1,
      compliance: 0.05,
    },
    recommendedTools: ["rag_search", "text_extract"],
    successCriteria: "是否遗漏重要信息，有无瞎编条款",
    costBenefit: {
      avgHumanCostPerTask: 5.0,
      autoSaveRatio: 0.6,
    },
  },
  dataAssistant: {
    id: "dataAssistant",
    name: "数据分析",
    description: "销售报表查询、同比环比计算、趋势预测",
    icon: "📊",
    testSetQuestions: [
      "上个月销售额是多少？同比增长了多少？",
      "哪个产品类别的销量最高？",
      "预测下个月的销售趋势",
    ],
    weight: {
      accuracy: 0.45,
      completeness: 0.2,
      relevance: 0.15,
      clarity: 0.1,
      calculation: 0.1,
    },
    recommendedTools: ["sql_executor", "python_interpreter"],
    successCriteria: "能否正确执行计算并给出可读结论",
    costBenefit: {
      avgHumanCostPerTask: 3.0,
      autoSaveRatio: 0.8,
    },
  },
};

export function getScenarios() {
  return Object.values(businessScenarios).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon,
  }));
}

export function getScenario(id: string): BusinessScenario | undefined {
  return businessScenarios[id];
}
