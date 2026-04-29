# `server/` 目录说明

Nuxt 3 在构建时由 **Nitro** 扫描本目录：这里的代码运行在 **Node 服务端**，不是浏览器。

## 分层

| 目录 | 作用 |
|------|------|
| **`api/`** | HTTP 接口。文件名决定 **路径** 与 **方法**（如 `foo.post.ts` → `POST /api/foo`；`[id].get.ts` → `GET /api/.../:id`）。 |
| **`services/`** | 可复用的业务逻辑：调大模型、打分、多厂商路由等，由 `api` 调用。 |
| **`config/`** | 与运行时相关的静态配置（如模型 id、厂商、估算成本）。 |
| **`utils/`** | 基础设施（如 Prisma 单例、数据库连接）。 |

## 数据与外部依赖

- **数据库**：通过 `utils/db.ts` 的 `prisma` 访问 PostgreSQL，模型定义在仓库根目录 `prisma/schema.prisma`。
- **大模型**：`services/llm.ts` 按模型厂商拼 `ChatOpenAI`（OpenAI 兼容接口）；密钥来自环境变量，勿写进代码。

## 更细的接口表

与请求体、响应结构相关的说明见仓库 [`docs/backend-flow.md`](../docs/backend-flow.md)。
