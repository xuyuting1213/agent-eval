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
- 后端与数据流说明见 [`docs/backend-flow.md`](docs/backend-flow.md)。

## 交付与文档

- `docs/ROADMAP.md`：阶段规划  
- `docs/WORKLOG.md`：实现记录  
- `docs/REVIEW_CHECKLIST.md`：自检清单  

更多框架级说明可参考 [Nuxt 文档](https://nuxt.com/docs/getting-started/introduction)。
