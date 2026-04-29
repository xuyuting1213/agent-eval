# 后端运作流程说明

本文描述本仓库（Nuxt 3 + Nitro + Prisma + LangChain 服务层）**服务端**的请求路径、分层职责与主要业务链路。

---

## 1. 技术栈与目录角色

| 路径 | 作用 |
|------|------|
| `server/api/` | HTTP 入口：Nitro 按文件名生成路由与 HTTP 方法 |
| `server/services/` | 业务与外部调用：大模型问答、多厂商路由、评分 |
| `server/services/llm.ts` | 统一创建 LangChain `ChatOpenAI`（按模型 `provider` 解析 Key / baseURL） |
| `server/utils/db.ts` | Prisma 单例与数据库连接（PostgreSQL） |
| `server/config/models.ts` | 模型元数据：厂商、定价、maxTokens 等 |
| `prisma/schema.prisma` | 数据模型：`TestSet`、`Evaluation` |

---

## 2. 请求如何进入后端

Nuxt 使用 **Nitro** 扫描 `server/api/`：

- 文件名中的 **HTTP 方法后缀** 决定动词，例如 `xxx.get.ts`、`xxx.post.ts`、`xxx.delete.ts`。
- **动态段** 使用方括号，例如 `test-sets/[id].get.ts` → `/api/test-sets/:id`。

每个 API 文件通常导出：

```ts
export default defineEventHandler(async (event) => {
  // readBody / getQuery / event.context.params
  return { ... }
})
```

前端通过 `$fetch('/api/...')` 调用上述路由。

---

## 3. 分层数据流（概念图）

```text
客户端 $fetch('/api/...')
        │
        ▼
┌───────────────────────┐
│  server/api/*.ts      │  参数校验（如 zod）、HTTP 错误、编排多步
└───────────┬───────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
┌────────────┐  ┌─────────────────────────────┐
│ prisma     │  │ server/services             │
│ (db.ts)    │  │ openai / multiProvider /    │
│            │  │ scorer → llm.createChatModel│
└────────────┘  └──────────────┬──────────────┘
                                 ▼
                        OpenAI 兼容 HTTP
                 （智谱 / OpenAI 官方 / 通义 DashScope 等）
```

---

## 4. API 路由一览

| 方法 | 路径 | 文件 | 主要职责 |
|------|------|------|----------|
| GET | `/api/config-status` | `config-status.get.ts` | 返回各厂商 Key 是否已配置（读环境变量） |
| GET | `/api/provider-status` | `provider-status.get.ts` | 提供商可用性相关状态 |
| POST | `/api/evaluate` | `evaluate.post.ts` | 单模型评测：答题 → 评分 → 写 `Evaluation` |
| POST | `/api/compare` | `compare.post.ts` | 多模型对比：并行答题与评分 |
| GET | `/api/test-sets` | `test-sets.get.ts` | 测试集列表 |
| POST | `/api/test-sets` | `test-sets.post.ts` | 创建测试集 |
| GET | `/api/test-sets/:id` | `test-sets/[id].get.ts` | 单个测试集详情 |
| DELETE | `/api/test-sets/:id` | `test-sets/[id].delete.ts` | 删除测试集 |
| POST | `/api/test-sets/:id/run` | `test-sets/[id]/run.post.ts` | 对指定测试集跑一轮评测并落库 |
| GET | `/api/evaluations` | `evaluations.get.ts` | 评测历史分页列表 |
| GET | `/api/evaluations/:id` | `evaluations/[id].get.ts` | 单条评测详情 |
| POST | `/api/evaluations/:id/save` | `evaluations/[id]/save.post.ts` | 保存/标记评测（若业务有使用） |
| GET | `/api/test-db` | `test-db.get.ts` | 数据库连通性探测（开发/调试用） |

---

## 5. 服务层模块说明

### 5.1 `server/services/llm.ts`

- 根据 `getModelConfig(modelValue)` 得到 `provider`，调用 `resolveProviderEnv` 解析 **apiKey** 与 **baseURL**。
- `createChatModel(modelValue, opts?)` 返回配置好的 `ChatOpenAI`（`@langchain/openai`），供问答与评分共用。
- `messageContentToString` / `usageFromAiMessage`：把 `AIMessage` 转为业务使用的文本与 token 统计（兼容不同元数据字段）。

### 5.2 `server/services/openai.ts`

- 首页/评测类流程使用的 **批量问答**：`callOpenAI`、`batchCallOpenAI`。
- 内部：`createChatModel` + `SystemMessage` / `HumanMessage` + `invoke`。
- 返回结构保持稳定：`content`、`promptTokens`、`completionTokens`、`totalTokens`、`duration`。

### 5.3 `server/services/multiProvider.ts`

- 对比页按 **模型 id** 路由到对应厂商（与 `models.ts` 一致），`callModel` 单次问答并计算 **token 成本**（按配置的每 1K 价格估算）。

### 5.4 `server/services/scorer.ts`

- 对「问题 + 答案」打分：`scoreAnswer`、`batchScore`。
- 使用 LangChain `ChatPromptTemplate` 编排提示词，模型返回 JSON 后经解析与 **zod** 校验；对厂商常带的 markdown 代码块做了剥离，避免解析失败。

### 5.5 `server/services/evaluations.get.ts`（若仍存在）

- 可能与 `evaluations.get.ts` API 存在逻辑重叠或复用，以仓库实际引用为准。

---

## 6. 核心业务链路

### 6.1 单模型评测：`POST /api/evaluate`

1. 校验请求体（问题列表、模型、可选 `testSetId`）。
2. 若未传 `testSetId`，可能自动创建一条 `TestSet`。
3. `batchCallOpenAI`：并发调用大模型生成每题答案。
4. `batchScore`：对每题答案打分。
5. `prisma.evaluation.create`：写入 `results`、`metrics` 等 JSON 字段。
6. 返回评测 id、带分结果与汇总 metrics。

### 6.2 多模型对比：`POST /api/compare`

1. 校验问题与多个模型 id。
2. 对每个模型并行执行 `callModel`（多厂商）。
3. 对每个模型的答案集调用 `batchScore`。
4. 组装为「按模型维度」的对比结果返回。

### 6.3 测试集一键评测：`POST /api/test-sets/:id/run`

1. `findUnique` 读取 `TestSet` 与题目列表。
2. 调用批量问答与评分（与评测主流程类似）。
3. 创建 `Evaluation` 并返回摘要与明细（供前端展示）。

### 6.4 测试集 CRUD

- `GET/POST /api/test-sets`、`GET/DELETE /api/test-sets/:id`：直接通过 Prisma 操作 `TestSet` 表。

### 6.5 历史与详情

- `GET /api/evaluations`：分页查询 `Evaluation`，并把 `metrics` Json 中的字段映射为列表展示结构。
- `GET /api/evaluations/:id`：单条记录及关联信息（以当前实现为准）。

---

## 7. 数据模型（Prisma）

- **TestSet**：评测问题集；`questions` 为 Json（通常为字符串数组）。
- **Evaluation**：一次评测结果；关联 `testSetId`；`results`、`metrics` 为 Json。

数据库连接字符串来自环境变量 **`DATABASE_URL`**；客户端在 `server/utils/db.ts` 中做单例与开发环境缓存。

---

## 8. 环境变量与厂商（摘要）

| 用途 | 典型变量 |
|------|----------|
| 智谱 | `ZHIPU_API_KEY`；可选 `ZHIPU_BASE_URL` / `OPENAI_BASE_URL` 覆盖默认兼容地址 |
| OpenAI | `OPENAI_API_KEY`；可选 `OPENAI_BASE_URL` |
| 通义 DashScope | `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY` / `ALIYUN_API_KEY` |
| 数据库 | `DATABASE_URL` |

具体「是否已配置」可由 `GET /api/config-status` 返回给前端。

---

## 9. 本地开发与安装后注意

- Prisma Client 需在依赖或 schema 变更后生成：`prisma generate`（本仓库 `postinstall` 已串联 `prisma generate && nuxt prepare`）。
- 修改 `.env` 后需重启 `npm run dev`，服务端环境变量才会重新加载。

---

## 10. 延伸阅读（仓库内文件）

- 模型清单与定价：`server/config/models.ts`
- 评测入口：`server/api/evaluate.post.ts`
- 对比入口：`server/api/compare.post.ts`
- LLM 工厂：`server/services/llm.ts`

如需把「每个 API 的请求体/响应体 JSON 示例」也写进文档，可在后续迭代中按接口逐个补充。
