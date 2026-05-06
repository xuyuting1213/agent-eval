# M1 / M2 实施说明（项目文档）

本文档对应原 **`docs/backend-flow.md`**（已更名为本文件），记录 **M1（核心评测与数据层）** 与 **M2（工作台流式、持久化与知识库）** 的后端路径、分层职责与主要链路。与 **`docs/M3-M4-implementation.md`**（Benchmark、对抗测试、业务评分与 ROI）衔接。

---

## M1：核心评测与数据层

### 范围

- Nuxt Nitro API、`Prisma` 的 **`TestSet` / `Evaluation`** 主干。
- 单模型评测、多模型对比、用例 CRUD 与一键跑分、历史列表与详情。
- 统一 **`llm.ts`** 工厂、**`multiProvider`** / **`openai`** 问答、**`scorer`** 技术评分。

### 技术栈与目录角色

| 路径 | 作用 |
|------|------|
| `server/api/` | HTTP 入口：按文件名生成路由与方法 |
| `server/services/` | 大模型调用、多厂商路由、评分 |
| `server/services/llm.ts` | 按模型 `provider` 解析 Key/baseURL，创建 `ChatOpenAI` |
| `server/utils/db.ts` | Prisma 单例（PostgreSQL） |
| `server/config/models.ts` | 模型元数据、估算美元/千 token |
| `prisma/schema.prisma` | 含 `TestSet`、`Evaluation` 等（后续里程碑会扩展更多模型） |

### 请求进入方式

- 文件名后缀表示 HTTP 方法：`*.get.ts`、`*.post.ts`、`*.delete.ts`。
- 动态段：`test-sets/[id].get.ts` → `/api/test-sets/:id`。
- 前端通过 `$fetch('/api/...')` 调用。

### 分层数据流（概念）

```text
客户端 $fetch('/api/...')
        │
        ▼
┌───────────────────────┐
│  server/api/*.ts      │  参数校验（如 zod）、HTTP 错误、编排
└───────────┬───────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
┌────────────┐  ┌─────────────────────────────┐
│ prisma     │  │ server/services             │
│ (db.ts)    │  │ openai / multiProvider /    │
│            │  │ scorer → createChatModel    │
└────────────┘  └──────────────┬──────────────┘
                               ▼
                      OpenAI 兼容 HTTP
               （智谱 / OpenAI / 通义 DashScope 等）
```

### M1 相关 API（主干）

| 方法 | 路径 | 主要职责 |
|------|------|----------|
| GET | `/api/config-status` | 各厂商 Key 是否已配置 |
| GET | `/api/provider-status` | 提供商状态 |
| POST | `/api/evaluate` | 单模型评测：答题 → 评分 → 写 `Evaluation` |
| POST | `/api/compare` | 多模型对比：并行答题与评分 |
| GET/POST | `/api/test-sets` | 用例列表与创建 |
| GET/DELETE | `/api/test-sets/:id` | 用例详情与删除 |
| POST | `/api/test-sets/:id/run` | 对用例跑一轮打分并落库 |
| GET | `/api/evaluations` | 评测历史分页 |
| GET | `/api/evaluations/:id` | 单条评测详情 |
| POST | `/api/evaluations/:id/save` | 保存/标记评测（若业务使用） |
| GET | `/api/test-db` | 数据库连通性（调试用） |

### 服务模块（M1）

- **`llm.ts`**：`createChatModel`、`resolveProviderEnv`、`messageContentToString`、`usageFromAiMessage`。
- **`openai.ts`**：批量问答 `callOpenAI` / `batchCallOpenAI`（首页/经典评测路径）。
- **`multiProvider.ts`**：按模型 id 调用 `callModel`，并估算 token 成本。
- **`scorer.ts`**：`scoreAnswer` / `batchScore`，JSON + zod 校验。

### 核心业务链路（M1）

1. **`POST /api/evaluate`**：校验 → 可选创建 `TestSet` → `batchCallOpenAI` → `batchScore` → `evaluation.create`。
2. **`POST /api/compare`**：多模型并行 `callModel` → 各模型 `batchScore` → 返回对比结构。
3. **`POST /api/test-sets/:id/run`**：读 `TestSet` → 批量问答与评分 → 创建 `Evaluation`。
4. **用例 CRUD**：直接 Prisma 操作 `TestSet`。
5. **历史**：`GET /api/evaluations`、`GET /api/evaluations/:id`。

### 数据模型（M1 相关）

- **TestSet**：一批问题，`questions` 多为字符串数组 JSON。
- **Evaluation**：一次评测；`results`、`metrics` 为 Json；可关联 `testSetId`。

### 环境变量（摘要）

| 用途 | 变量 |
|------|------|
| 智谱 | `ZHIPU_API_KEY`；可选 `ZHIPU_BASE_URL` / `OPENAI_BASE_URL` |
| OpenAI | `OPENAI_API_KEY`；可选 `OPENAI_BASE_URL` |
| 通义 | `DASHSCOPE_API_KEY` 等 |
| 数据库 | `DATABASE_URL` |

---

## M2：工作台流式、持久化与知识库

### 范围

- 工作台 **SSE 流式** 评测（含工具）、结果 **持久化**（轨迹、工具指标、业务场景）。
- **知识库** CRUD、文档入库、向量检索。
- **业务场景** 列表供前端与工作台入参。

### M2 相关 API

| 方法 | 路径 | 主要职责 |
|------|------|----------|
| POST | `/api/evaluate/stream` | 流式评测（按当前实现，可与工作台联动） |
| POST | `/api/evaluate/stream-with-tools` | 流式 + 工具调用；支持 `scenario`；返回轨迹与工具质量等 |
| POST | `/api/evaluations/persist` | 工作台流式结果落库；`trajectory`、`toolMetrics`、`scenario`、`metrics`；**M4** 在此叠加业务分与 ROI（见 `M3-M4-implementation.md`） |
| GET/POST | `/api/knowledge-base` | 知识库列表与创建 |
| POST | `/api/knowledge-base/:id/documents` | 上传解析文档、切分与向量化 |
| POST | `/api/knowledge-base/:id/search` | 相似检索 Top-K |
| GET | `/api/business/scenarios` | 内置业务场景（客服/文档/数据等） |
| GET | `/api/stats/cost` | 成本统计（若前端使用） |
| GET | `/api/stats/performance` | 性能统计（若前端使用） |

### 服务与实现要点（M2）

- **`streamWithToolsPipeline.ts`**（及薄路由 **`evaluate/stream-with-tools.post.ts`**）：与工作台一致的工具管线（联网、天气、知识检索等），详见 **M3** 文档中的复用说明。
- **`persist.post.ts`**：接收工作台聚合结果，服务端 **`batchScore`** 技术分；在带合法 **`scenario`** 时追加 **业务评分与 ROI**（M4）。
- 知识库服务逻辑位于 **`server/services/knowledgeBase.ts`**（及 Prisma `KnowledgeBase` 等相关表）。

### M2 使用提示

- 流式与持久化依赖 **`DATABASE_URL`** 与已执行迁移；Chroma 等向量侧见根目录 **README** 的 `CHROMA_URL` 说明。
- 修改 `.env` 后需重启 `npm run dev`。

---

## 延伸阅读

| 主题 | 路径 |
|------|------|
| 后续里程碑（Benchmark / 对抗 / 业务报告） | `docs/M3-M4-implementation.md` |
| 模型清单与定价 | `server/config/models.ts` |
| 评测入口 | `server/api/evaluate.post.ts` |
| 对比入口 | `server/api/compare.post.ts` |
| LLM 工厂 | `server/services/llm.ts` |

如需为单个接口补充请求/响应 JSON 示例，可在后续迭代按接口追加附录。
