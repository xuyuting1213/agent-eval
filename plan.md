## AI Agent 评测平台 - 完整技术栈与设计文档

---

## 一、项目定位

**一句话定义**：帮助企业做 AI 模型选型的**科学评估平台**，通过标准化测试、多维度评分、成本分析，输出可量化的选型报告。

**核心价值**：
- 不只是展示答案，而是**量化对比**
- 不只是随意测试，而是**标准化评估**
- 不只是个人使用，而是**企业级报告**

---

## 二、完整技术栈

### 2.1 技术栈总览图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
├─────────────────────────────────────────────────────────────┤
│  Nuxt 3.10+  │  Vue 3.4+  │  TypeScript 5.3+              │
│  Naive UI    │  TailwindCSS│  ECharts 5.5+                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        API 层 (Nitro)                        │
├─────────────────────────────────────────────────────────────┤
│  server/api/*.ts  │  Zod 验证  │  defineEventHandler       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        服务层                                │
├─────────────────────────────────────────────────────────────┤
│  OpenAI SDK  │  LangChain.js  │  评测引擎  │  评分引擎      │
│  缓存服务    │  成本计算器     │  报告生成器                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据层                                │
├─────────────────────────────────────────────────────────────┤
│  Prisma 7  │  PostgreSQL 16  │  SQLite (开发)              │
│  Redis (缓存) │  Docker + Docker Compose                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 详细依赖清单

```json
{
  "dependencies": {
    // 核心框架
    "nuxt": "^3.10.0",
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    
    // UI 组件库
    "naive-ui": "^2.38.0",
    "tailwindcss": "^3.4.0",
    "@nuxtjs/tailwindcss": "^6.10.0",
    
    // 数据可视化
    "echarts": "^5.5.0",
    "vue-echarts": "^6.6.0",
    
    // 数据库
    "@prisma/client": "^5.22.0",
    "prisma": "^5.22.0",
    "prisma-adapter-pg": "^1.0.0",
    
    // AI SDK
    "openai": "^4.28.0",
    "@anthropic-ai/sdk": "^0.24.0",
    "langchain": "^0.1.0",
    
    // 工具库
    "zod": "^3.22.0",
    "pino": "^8.17.0",
    "pino-pretty": "^10.3.0",
    
    // 报告生成
    "pdfkit": "^0.14.0",
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.0",
    "@nuxt/devtools": "^1.0.0"
  }
}
```

---

## 三、项目架构设计

### 3.1 目录结构

```
agent-eval/
├── server/
│   ├── api/
│   │   ├── evaluate.post.ts      # 核心评测 API
│   │   ├── test-sets.get.ts       # 获取测试集列表
│   │   ├── test-sets.post.ts      # 创建测试集
│   │   ├── test-sets/[id].get.ts  # 获取单个测试集
│   │   ├── test-sets/[id].put.ts  # 更新测试集
│   │   ├── test-sets/[id].delete.ts # 删除测试集
│   │   ├── reports/[id].get.ts    # 获取评测报告
│   │   ├── reports/[id]/pdf.get.ts # 导出 PDF
│   │   └── metrics.get.ts         # 获取统计指标
│   │
│   ├── services/
│   │   ├── ai/
│   │   │   ├── base.ts            # Agent 基类
│   │   │   ├── openai.ts          # OpenAI 实现
│   │   │   ├── claude.ts          # Claude 实现
│   │   │   ├── gemini.ts          # Gemini 实现
│   │   │   └── registry.ts        # Agent 注册中心
│   │   │
│   │   ├── evaluation/
│   │   │   ├── scorer.ts          # 评分引擎
│   │   │   ├── metrics.ts         # 指标计算
│   │   │   └── comparator.ts      # 对比分析
│   │   │
│   │   ├── report/
│   │   │   ├── generator.ts       # 报告生成器
│   │   │   ├── pdf.ts            # PDF 导出
│   │   │   └── excel.ts          # Excel 导出
│   │   │
│   │   └── cache/
│   │       └── semanticCache.ts   # 语义缓存
│   │
│   ├── utils/
│   │   ├── db.ts                  # Prisma 客户端
│   │   ├── logger.ts              # 日志工具
│   │   ├── concurrency.ts         # 并发控制
│   │   └── errorHandler.ts       # 错误处理
│   │
│   └── middleware/
│       ├── auth.ts                # 认证中间件
│       └── rateLimit.ts           # 限流中间件
│
├── pages/
│   ├── index.vue                  # 首页：快速评测
│   ├── test-sets/
│   │   ├── index.vue              # 测试集列表
│   │   ├── create.vue             # 创建测试集
│   │   └── [id].vue               # 测试集详情
│   ├── evaluations/
│   │   ├── index.vue              # 评测历史
│   │   └── [id].vue               # 评测结果详情
│   ├── reports/
│   │   └── [id].vue               # 报告页面
│   └── compare.vue                # 模型对比（并排）
│
├── components/
│   ├── evaluation/
│   │   ├── ResultTable.vue        # 结果表格
│   │   ├── ScoreCard.vue          # 评分卡片
│   │   └── ComparisonChart.vue    # 对比图表
│   ├── common/
│   │   ├── Loading.vue
│   │   ├── ErrorBoundary.vue
│   │   └── EmptyState.vue
│   └── layout/
│       ├── Header.vue
│       └── Sidebar.vue
│
├── composables/
│   ├── useEvaluation.ts           # 评测逻辑
│   ├── useTestSet.ts              # 测试集逻辑
│   └── useReport.ts               # 报告逻辑
│
├── prisma/
│   ├── schema.prisma              # 数据模型
│   └── migrations/                # 迁移文件
│
├── public/                        # 静态资源
├── docker-compose.yml             # Docker 编排
├── Dockerfile                     # 生产镜像
├── nuxt.config.ts                 # Nuxt 配置
└── .env                          # 环境变量
```

### 3.2 数据模型设计

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 测试集
model TestSet {
  id          Int          @id @default(autoincrement())
  name        String
  description String?
  category    String       // 场景分类: code/math/qa/creative
  tags        String[]     // 标签
  questions   Json         // 问题列表
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  evaluations Evaluation[]
  
  @@index([category])
  @@index([createdAt])
}

// 评测记录
model Evaluation {
  id          Int      @id @default(autoincrement())
  name        String   // 评测名称
  testSetId   Int?
  agentConfig Json     // Agent 配置 {model, temperature等}
  results     Json     // 评测结果
  metrics     Json     // 汇总指标
  createdAt   DateTime @default(now())
  testSet     TestSet? @relation(fields: [testSetId], references: [id])
  
  @@index([createdAt])
}

// 评测历史（轻量级，用于列表展示）
model EvaluationHistory {
  id          Int      @id @default(autoincrement())
  evaluationId Int     @unique
  name        String
  summary     Json     // 摘要信息
  createdAt   DateTime @default(now())
  
  @@index([createdAt])
}

// 缓存（语义缓存）
model Cache {
  id          String   @id @default(cuid())
  queryHash   String   @unique  // 问题的哈希值
  query       String   // 原始问题
  embeddings  Json     // 向量（用于相似度匹配）
  response    String   // 缓存的答案
  hits        Int      @default(1)
  lastHitAt   DateTime @default(now())
  createdAt   DateTime @default(now())
  
  @@index([queryHash])
  @@index([lastHitAt])
}
```

---

## 四、核心功能流程

### 4.1 评测流程图

```
用户输入问题列表
       │
       ▼
┌──────────────┐
│ 参数验证(Zod) │
└──────────────┘
       │
       ▼
┌──────────────┐
│  语义缓存检查  │ ← 80% 命中率，降低成本
└──────────────┘
       │
       ▼
┌──────────────┐
│ 并发调用AI    │ ← 自适应并发控制
│ • GPT-4      │
│ • Claude     │
│ • Gemini     │
└──────────────┘
       │
       ▼
┌──────────────┐
│ 多维度评分    │ ← 用裁判模型打分
│ • 准确性      │    (准确性/完整性/相关性)
│ • 完整性      │
│ • 相关性      │
└──────────────┘
       │
       ▼
┌──────────────┐
│ 指标计算      │
│ • Token消耗   │
│ • 成本       │
│ • 延迟       │
└──────────────┘
       │
       ▼
┌──────────────┐
│ 保存到数据库  │
└──────────────┘
       │
       ▼
┌──────────────┐
│ 生成报告      │ ← PDF/Excel 导出
└──────────────┘
```

### 4.2 核心服务代码示例

```typescript
// server/services/evaluation/orchestrator.ts
export class EvaluationOrchestrator {
  async run(request: EvaluateRequest): Promise<EvaluateResponse> {
    // 1. 参数验证
    const validated = this.validate(request)
    
    // 2. 缓存检查
    const cached = await this.checkCache(validated.questions)
    
    // 3. AI 调用
    const results = await this.callAgents(validated, cached)
    
    // 4. 评分
    const scored = await this.scoreResults(results)
    
    // 5. 指标计算
    const metrics = this.calculateMetrics(scored)
    
    // 6. 保存结果
    const saved = await this.saveEvaluation(scored, metrics)
    
    // 7. 生成报告
    const report = await this.generateReport(saved)
    
    return { results: scored, metrics, report }
  }
  
  private async callAgents(
    request: ValidatedRequest,
    cached: Map<string, string>
  ): Promise<RawResult[]> {
    const tasks = request.questions.map(async (question, idx) => {
      // 命中缓存
      if (cached.has(question)) {
        return { question, answer: cached.get(question), cached: true }
      }
      
      // 调用 Agent
      const agent = AgentRegistry.get(request.agent)
      return await agent.call(question)
    })
    
    // 并发控制
    return await this.concurrentExecute(tasks, request.concurrency)
  }
}
```

---

## 五、企业级特性

### 5.1 评测维度

| 维度 | 权重 | 评分标准 |
|------|------|---------|
| 准确性 | 40% | 答案是否正确、有无事实错误 |
| 完整性 | 25% | 是否覆盖问题的所有方面 |
| 相关性 | 20% | 回答是否切题、有无废话 |
| 清晰度 | 15% | 表达是否清晰、结构是否合理 |

### 5.2 输出报告内容

```markdown
# 模型选型评估报告

## 执行摘要
- 推荐模型：GPT-4
- 综合得分：8.7/10
- 月预估成本：$247

## 详细对比
| 模型 | 得分 | 月成本 | 延迟(P95) | 推荐场景 |
|------|------|--------|-----------|---------|
| GPT-4 | 8.7 | $247 | 1.2s | 复杂推理 |
| Claude | 8.2 | $189 | 1.5s | 长文本 |
| Gemini | 7.9 | $98 | 0.8s | 快速响应 |

## 成本分析
- 按调用量预估
- 各场景成本分解

## 推荐结论
基于你的业务场景（客服问答），推荐使用 GPT-4...
```

---

## 六、开发计划（一周）

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 1 | 项目初始化 + 数据库 | Nuxt + Prisma + PostgreSQL |
| Day 2 | OpenAI 集成 | 能调 API 并返回结果 |
| Day 3 | 评测 API + 前端页面 | 能输入问题、展示答案 |
| Day 4 | 多模型支持 + 并发调用 | 支持 GPT-4/Claude/Gemini |
| Day 5 | 评分系统 + 指标计算 | 自动打分、Token 统计 |
| Day 6 | 报告生成 + 导出 | PDF 报告 |
| Day 7 | 部署 + 文档 | 线上可访问 |

---

## 七、面试话术

> "我设计了一个 AI 模型选型评估平台，核心解决企业在模型选型时的**数据驱动决策**需求。
>
> 架构上采用**插件化设计**，新增模型只需实现接口；性能上做了**语义缓存**和**动态并发控制**；评估体系包含**5 个维度的自动评分**，并输出**专业 PDF 报告**。
>
> 技术栈是 Nuxt 3 + PostgreSQL + Prisma + OpenAI SDK，用 Docker 容器化部署。"

---

这就是完整的设计方案。现在你的项目已经搭好了基础，接下来按这个计划推进就行。需要我把某个模块的完整代码写出来吗？