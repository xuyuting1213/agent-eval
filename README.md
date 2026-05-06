# 比言

对齐**同一批问题**，对比各**模型回答**，按统一维度**自动打分**并留痕。适合选型、质检与内部分享结论。

## 线上地址

- **公网演示**：[http://101.133.162.147:3000/](http://101.133.162.147:3000/)
- **源码仓库**：[github.com/xuyuting1213/agent-eval](https://github.com/xuyuting1213/agent-eval)

- **工作台**：单模型批量回答 + 打分  
- **横评**：多模型并排对比与得分  
- **用例**：保存常用问题组合，一键载入
- **记录**：历史打分与对比结果  

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 构建与预览

```bash
npm run build
npm run preview
```

## 环境与数据

- 复制 [`.env.example`](.env.example) 为 `.env`，填写各模型 Key 与 **`DATABASE_URL`**。
- 本项目默认使用 **PostgreSQL**。若用仓库里的 `docker-compose.yml` 起库，映射端口是 **`5433`**（不是 5432），`DATABASE_URL` 需与之对应。
- 首次连库后执行迁移：`npx prisma migrate deploy`（或开发环境 `npx prisma db push`）。
- 后端与数据流说明见 [`docs/M1-M2-implementation.md`](docs/M1-M2-implementation.md)；Benchmark / 业务报告等见 [`docs/M3-M4-implementation.md`](docs/M3-M4-implementation.md)。
- 若启用知识库向量检索，需要额外启动 Chroma 服务（默认 `http://localhost:8000`，可用 `CHROMA_URL` 覆盖）。

## 业务场景与知识库 API

- `GET /api/business/scenarios`：获取内置企业场景（智能客服/合同审查/数据分析）。
- `POST /api/evaluate/stream-with-tools`：流式评测，支持 `scenario` 入参并回传执行轨迹与工具质量指标。
- `POST /api/evaluations/persist`：持久化工作台评测，支持保存 `trajectory/toolMetrics/scenario`。
- `POST /api/knowledge-base`、`GET /api/knowledge-base`：创建/查询知识库。
- `POST /api/knowledge-base/:id/documents`：上传并解析 PDF/DOCX/TXT/MD 文档，异步切分与向量化。
- `POST /api/knowledge-base/:id/search`：按 query 做相似检索，返回 Top-K 文本片段。

## 交付与文档

- `docs/M1-M2-implementation.md`：核心评测与工作台 / 知识库（原 backend-flow）  
- `docs/M3-M4-implementation.md`：Benchmark、对抗测试、业务评分与 ROI  
- `docs/ROADMAP.md`：阶段规划  
- `docs/WORKLOG.md`：实现记录  
- `docs/REVIEW_CHECKLIST.md`：自检清单  

更多框架级说明可参考 [Nuxt 文档](https://nuxt.com/docs/getting-started/introduction)。
