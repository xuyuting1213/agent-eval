/**
 * 内置 Benchmark 任务套件定义；同步到数据库后由 /api/benchmark/run 逐条执行。
 */
export interface BenchmarkTaskDef {
  id: string;
  name: string;
  input: string;
  expectedTools: string[];
  successCriteria: string;
  tags?: string[];
}

export interface BenchmarkSuiteDef {
  name: string;
  category: string;
  description: string;
  tasks: BenchmarkTaskDef[];
}

export const generalBenchmark: BenchmarkSuiteDef = {
  name: "通用能力测试",
  category: "general",
  description: "测试模型的基础理解、推理、知识问答能力",
  tasks: [
    {
      id: "general_1",
      name: "常识问答",
      input: "中国的首都是哪里？",
      expectedTools: [],
      successCriteria: "回答应指出首都为北京或 Beijing",
    },
    {
      id: "general_2",
      name: "逻辑推理",
      input: "如果所有A都是B，所有B都是C，那么所有A都是C吗？",
      expectedTools: [],
      successCriteria: "应给出肯定结论或等价正确推理",
    },
    {
      id: "general_3",
      name: "数学计算",
      input: "计算 12345 + 67890 = ?",
      expectedTools: [],
      successCriteria: "结果应为 80235",
    },
    {
      id: "general_4",
      name: "代码生成",
      input: "写一个 Python 函数，计算斐波那契数列的第 n 项",
      expectedTools: [],
      successCriteria: "应包含 def 与递归或循环等可执行思路",
    },
  ],
};

export const customerServiceBenchmark: BenchmarkSuiteDef = {
  name: "客服场景测试",
  category: "customerService",
  description: "测试模型在客服场景下的表现",
  tasks: [
    {
      id: "cs_1",
      name: "退换货政策查询",
      input: "我买了你们的产品，用了10天了，可以退货吗？",
      expectedTools: ["knowledge_search", "web_search"],
      successCriteria: "应结合政策说明是否可退，并建议联系渠道或查看条款",
    },
    {
      id: "cs_2",
      name: "情绪安抚",
      input: "你们的产品太差了，我用了两天就坏了，非常生气！",
      expectedTools: [],
      successCriteria: "应先致歉再给出处理步骤或升级渠道",
    },
    {
      id: "cs_3",
      name: "多渠道查询",
      input: "帮我查一下京东上 iPhone 15 的最新价格和北京今天天气",
      expectedTools: ["web_search", "weather_search"],
      successCriteria: "应说明需联网或给出获取价格的合理方式，并给出北京今天天气",
    },
  ],
};

export const dataAnalysisBenchmark: BenchmarkSuiteDef = {
  name: "数据分析测试",
  category: "dataAssistant",
  description: "测试模型的数据分析和计算能力",
  tasks: [
    {
      id: "da_1",
      name: "销售统计",
      input: "公司1月销售100万，2月120万，3月150万，计算季度总销售额",
      expectedTools: [],
      successCriteria: "总额应为 370 万或 3700000 等等价表述",
    },
    {
      id: "da_2",
      name: "趋势分析",
      input: "根据上面的数据，分析销售趋势",
      expectedTools: [],
      successCriteria: "应指出逐月上升或持续增长",
    },
    {
      id: "da_3",
      name: "数据可视化",
      input: "用 Python 画一个销售趋势图",
      expectedTools: [],
      successCriteria: "应给出 matplotlib 或类似绘图代码片段",
    },
  ],
};

export const allBenchmarks: BenchmarkSuiteDef[] = [
  generalBenchmark,
  customerServiceBenchmark,
  dataAnalysisBenchmark,
];
