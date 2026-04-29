---
name: git-upload
description: >-
  Guides committing and pushing this repository to Git (GitHub/GitLab/Gitee)
  with safe checks. Use when the user asks to upload code, push to remote,
  提交代码, git push, sync repo, or publish changes.
---

# Git 上传代码（本仓库）

## 前置检查

- 确认 **不提交密钥**：`.env`、`*.pem`、含 API Key 的本地文件应在 `.gitignore` 中；提交前可执行 `git status` 扫一眼。
- 确认 **远程已配置**：`git remote -v`。若无：`git remote add origin <仓库 HTTPS 或 SSH URL>`。

## 推荐流程（终端在项目根目录）

```bash
git status
git add -A
git diff --staged          # 可选：确认改动
git commit -m "feat: 简短说明（中文完整句）"
git pull --rebase origin main   # 若远程已有提交，减少无关 merge
git push -u origin main
```

首次推空仓库时，本地分支若不是 `main`：先 `git branch -M main` 再 `push`。

## 认证与网络

- **HTTPS**：需 GitHub PAT 或浏览器登录凭据助手；无交互环境可能报 `could not read Username`。
- **SSH**：`git remote set-url origin git@github.com:OWNER/REPO.git`，本机需配置 `ssh-keygen` 与 GitHub SSH Key。
- **连不上 github.com:443**（超时 / `Failed to connect`）：检查 VPN/代理；可为 Git 单独设代理，或改用 SSH 走 `ssh.github.com:443`（见 GitHub 文档）。
- **推送权限**：确认对目标仓库有 `write`，fork 需推到自己仓库或提 PR。

## 与本项目相关

- `package.json` 的 `name` 为 **`biyan`**；数据库依赖 **`DATABASE_URL`**，勿把真实连接串写入仓库。
- Docker 仅用于本地 Postgres；**Docker 未启动** 与 **git push** 无关，但会影响本地跑 `evaluate` 等写库接口。

## 出问题时的最小定位

| 现象 | 常见原因 |
|------|----------|
| `rejected non-fast-forward` | 先 `git pull --rebase origin main` 再 push |
| `Permission denied (publickey)` | SSH 未配置或未加到托管平台 |
| `403` / `access denied` | 无写权限或 token 过期 |
| `ECONNREFUSED` / 连接超时 | 网络或代理；换网络或配置 `http.proxy` / SSH |

## Agent 行为约定

- 在仓库内执行 `git` 时请求 **`git_write`**（及需要时的 **`network`**）。
- 不替用户决定提交信息里的业务含义；可起草 `git commit -m`，由用户确认后再提交。
- 若用户未指定远程或分支，默认 **`origin`** 与 **`main`**，并说明假设。
