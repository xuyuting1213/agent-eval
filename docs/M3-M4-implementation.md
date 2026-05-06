# M3 / M4 实施说明（项目文档）

本文档记录 **M3（Benchmark + 对抗测试）** 与 **M4（业务指标评分 + ROI）** 已在仓库中落地的能力、主要文件入口与使用方式，便于交接与二次开发。

**前置里程碑**：核心评测与工作台/知识库等见 [`M1-M2-implementation.md`](./M1-M2-implementation.md)。

---

## M3：Benchmark + 对抗测试

### 目标概览

| 方向 | 说明 |
|------|------|
| 标准化 Benchmark | 内置套件同步到库，一键跑批、落库、汇总成功率与均分 |
| 带工具跑批 | 任务配置 `expectedTools` 时，走与工作台等价的 **stream-with-tools** 管线（联网 / 天气 / 可选知识库） |
| 对抗测试 | 独立 API + 规则/评分混合判定 + 运行历史落库；与套件「鲁棒性对抗测试」任务对齐 |

### 数据模型（Prisma）

- **`BenchmarkSuite`**：套件元数据 + `tasks`（JSON 任务列表）。
- **`BenchmarkRun`**：单次跑批的 `results`、`summary`、关联 `suiteId`、`model`。
- **`AdversarialTest`**：对抗元数据与任务快照（配置同步用）。
- **`AdversarialRun`**：独立对抗跑批记录（`results`、`summary`、`byCategory`）。

迁移位于 `prisma/migrations/`（含 `add_benchmark_and_adversarial`、`add_adversarial_run` 等）。本地开发在拉取 schema 变更后需执行 `npx prisma generate`；仓库已配置 **`predev`: `prisma generate`**，避免 Prisma Client 与 schema 脱节。

### 配置与种子

| 文件 | 作用 |
|------|------|
| `server/config/benchmarks.ts` | 通用 / 客服 / 数据分析等内置套件定义 |
| `server/config/adversarial.ts` | 对抗任务（越狱、信息泄露、模糊、无意义、边界等） |
| `server/utils/benchmarkSeed.ts` | 将上述配置 **upsert** 到 `BenchmarkSuite` / `AdversarialTest` |

### 核心服务

| 文件 | 作用 |
|------|------|
| `server/services/streamWithToolsPipeline.ts` | 单题带工具流：`iterateStreamWithTools`、`collectStreamWithToolsRun`（供 SSE 与 Benchmark 复用） |
| `server/services/benchmarkRun.ts` | 单题：`expectedTools` 为空则 **直连 `callModel` + 技术评分**；否则 **`collectStreamWithToolsRun` + 评分与工具启发式**；`executeBenchmarkSuite` 汇总 |
| `server/services/adversarialEvaluate.ts` | 对抗单题输出规则判定；**edgeCase** 走 `scoreAnswer` |
| `server/services/adversarialSuiteRun.ts` | `executeAdversarialSuite`：`callModel` 逐题 + 评估 + 分类汇总 |

### API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/benchmark` | 套件列表、近期 `BenchmarkRun`、按模型简易对比 |
| POST | `/api/benchmark/run` | body：`suiteId`、`model`，可选 `scenario`、`knowledgeBaseId` |
| POST | `/api/benchmark/adversarial` | 独立跑完整对抗套件（文件：`server/api/benchmark/adversarial/index.post.ts`，与同目录子路由共存） |
| GET | `/api/benchmark/adversarial/history` | 最近对抗运行摘要 |
| GET | `/api/benchmark/adversarial/:id` | 单次对抗运行详情 |

### 前端

- **`pages/benchmark.vue`**：套件卡片、模型选择、**业务场景 + 知识库**（供带工具任务）、近期对比、运行历史、结果弹窗（含 `runMode` / `toolCalls` / `hasKnowledgeHit`）。**`runningSuiteId`** 仅当前套件显示「运行中…」，其它套件在跑批中禁用但文案仍为「运行」。
- **`server/api/evaluate/stream-with-tools.post.ts`**：薄封装，循环 `iterateStreamWithTools` 写 SSE。

### M3 使用提示

1. 跑批前确认 **数据库迁移** 与 **`prisma generate`** 已执行；开发启动 **`npm run dev`** 会触发 `predev`。
2. 带 **`knowledge_search` / 知识** 期望且选了知识库时，Benchmark 侧有 **工具 / 命中** 相关启发式（见 `benchmarkRun.ts`）。
3. 对抗测试 **未使用** `reactAgent`；直连 **`callModel`**，与套件内「仅技术评分」路径可对照使用。

---

## M4：业务指标评分 + ROI + 业务报告

### 目标概览

| 方向 | 说明 |
|------|------|
| 业务指标评分 | 按 **`server/config/businessScenarios.ts`** 中场景的 **权重与成功标准**，对「问题 + 回答」做结构化业务分与改进建议 |
| ROI 测算 | 基于 **`server/config/models.ts`** 的单价、场景 **`costBenefit`**、本次 **token** 与可选 **日均量**，写入 `metrics.roi` |
| 业务报告 | 只读聚合 API + 独立页面展示决策摘要、维度、ROI、建议与逐题摘要 |

### 核心服务

| 文件 | 作用 |
|------|------|
| `server/services/businessScorer.ts` | `scoreByScenario` / `batchBusinessScore`：使用 **`createChatModel`（如 `glm-4-flash`）** 输出 JSON，Zod 校验；无仓库内的 `createJsonModel` |
| `server/services/roiCalculator.ts` | `calculateROI`：从 **`getModelConfig`** 取美元/千 token 混合单价；**ROI** 采用「日人工节省 vs 按本次 token 均摊的日模型成本」的可解释估算（避免量纲混用） |

### 与评测落库的集成

- **`server/api/evaluations/persist.post.ts`**  
  - 在原有 **`batchScore`（技术分）** 之后：若 body 带 **`scenario`** 且 **`getScenario(scenario)`** 存在，且至少有一条非空答案，则：  
    - 调用 **`batchBusinessScore`**；  
    - 汇总 **`metrics.businessScore`**、平均 **`businessDimensions`**、**`businessFeedback`** / **`businessRecommendations`**、**`metrics.roi`**；  
    - 在每条 **`results`** 上写入 **`businessScore`**、**`businessDimensions`**、**`businessFeedback`**、**`businessRecommendations`**。

### 业务报告 API 与页面

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/evaluations/:id/business-report` | 聚合 `Evaluation` + `TestSet`，返回场景信息、业务分、ROI、逐题摘要、**`decision`** 文案 |

- **`pages/evaluation/[id]/business-report.vue`**：决策摘要、业务分与维度条、ROI 四格、改进建议、逐题摘要、JSON 导出；无业务层数据时顶部提示。
- **`pages/evaluation/[id].vue`**：概览区增加 **「业务报告」** 入口链到上述子页。

### M4 使用提示

1. 工作台保存评测时传入 **`scenario`**（如 `customerService`、`documentAnalysis`、`dataAssistant`），才会写入业务分与 ROI。  
2. **ROI 为估算**，用于内部看板与沟通；上线财务口径前请用贵司真实工单量、人力单价与账单校准。  
3. 历史记录在 **未选场景** 的旧数据上打开业务报告时，页面会提示缺少业务层数据，仍可查看通用摘要（若 API 有返回）。

---

## 路径索引（快速跳转）

| 领域 | 路径 |
|------|------|
| Benchmark 配置 | `server/config/benchmarks.ts` |
| 对抗配置 | `server/config/adversarial.ts` |
| 业务场景 | `server/config/businessScenarios.ts` |
| 模型与单价 | `server/config/models.ts` |
| Benchmark 跑批 | `server/services/benchmarkRun.ts` |
| 带工具管线 | `server/services/streamWithToolsPipeline.ts` |
| 对抗执行 | `server/services/adversarialSuiteRun.ts`、`server/services/adversarialEvaluate.ts` |
| 业务评分 | `server/services/businessScorer.ts` |
| ROI | `server/services/roiCalculator.ts` |
| Prisma | `prisma/schema.prisma`、`prisma/migrations/` |
| Benchmark 页 | `pages/benchmark.vue` |
| 评测详情 / 业务报告 | `pages/evaluation/[id].vue`、`pages/evaluation/[id]/business-report.vue` |

---

## 文档维护

若后续迭代变更行为（例如新增场景、调整 ROI 公式或 Benchmark 通过规则），请同步更新本文件与 `docs/ROADMAP.md`（若适用），避免文档与代码长期漂移。
