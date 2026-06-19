# 城科卷王

城科卷王是一个面向题库刷题、学习进度追踪和排行榜同步的多页面 Web 应用。项目部署在 Cloudflare Pages，并通过 Cloudflare Worker + D1 提供题库管理、云同步、排行榜和公告接口。

## 在线部署

- Cloudflare Pages 项目：https://dash.cloudflare.com/29384b90082af8364a4570c7da0b0549/pages/view/ks
- Pages 生产域名：https://ks-cjx.pages.dev
- 自定义域名：https://ks.mutx.ccwu.cc
- API 服务：https://ks-api.mutx.ccwu.cc

> 注意：项目使用 Cloudflare Pages 自动构建，不需要提交 `dist/`。将代码推送到 GitHub `main` 分支后，Cloudflare Pages 会自动执行 `npm run build` 并部署。

## 技术栈

- 前端：原生 HTML / CSS / JavaScript（ES Modules）
- 构建：Vite 多页面构建
- 代码高亮：Prism.js
- 数学公式：KaTeX
- 图标：Lucide
- 前端存储：localStorage
- 后端：Cloudflare Worker
- 数据库：Cloudflare D1
- 部署：Cloudflare Pages + GitHub 自动部署

## 页面入口

| 页面 | 说明 |
| --- | --- |
| `index.html` | 首页，展示题库、统计、错题本、搜索和设置入口 |
| `quiz.html` | 刷题页，支持顺序、随机、错题、背题、复习、收藏和考试 |
| `analysis.html` | 学习分析页 |
| `trend.html` | 学习趋势页 |
| `leaderboard.html` | 排行榜页 |
| `admin.html` | 管理后台 |

Vite 会自动扫描根目录下所有 `.html` 文件作为构建入口，确保 Cloudflare Pages 部署时这些页面都会输出。

## 本地开发

```bash
npm install
npm run dev
```

开发服务器默认：

```text
http://localhost:3000
```

## 构建验证

```bash
npm run build
npm run preview
```

构建输出目录为 `dist/`，该目录由 Cloudflare Pages 自动生成，已在 `.gitignore` 中忽略。

## Cloudflare Pages 配置

Cloudflare Pages 项目应保持：

```text
Build command: npm run build
Build output directory: dist
Root directory: /
```

部署流程：

1. 本地修改代码
2. 本地执行 `npm run build` 验证
3. 提交并推送到 GitHub `main`
4. Cloudflare Pages 自动拉取并部署

不要手动提交 `dist/`，也不要在未确认前主动推送部署。

## 题库来源

生产环境题库只从 Worker API 加载：

```text
GET https://ks-api.mutx.ccwu.cc/api/banks
GET https://ks-api.mutx.ccwu.cc/api/bank/:id
```

`banks/*.json` 仅作为人工备份文件，不参与前端运行时加载，也不会作为 API 失败时的兜底来源。构建产物中也不复制 `banks/` 目录。

如果要让题库在生产环境出现，必须通过 `admin.html` 管理后台导入并启用云端题库。

备份文件清单可记录在 `js/config.js` 的 `backupBankFiles`，但这个清单只作人工备份说明，前端不会导入或读取它。

## 用户数据存储

浏览器本地数据保存在 localStorage：

| Key | 说明 |
| --- | --- |
| `quiz_progress` | 答题进度、逐题状态、间隔复习数据、累计时长 |
| `quiz_settings` | 用户设置 |
| `quiz_history` | 答题历史 |
| `quiz_bookmarks` | 收藏题 |
| `quiz_session` | 未完成刷题会话 |
| `quiz_recent_banks` | 最近使用题库 |
| `ks_sync_code` | 云同步码 |
| `ks_device_id` | 当前设备 ID |

## Worker / D1

后端代码位于：

```text
worker/src/index.js
worker/schema.sql
worker/wrangler.toml
```

主要接口：

```text
POST /api/register
POST /api/bind
GET  /api/user/:did
POST /api/sync
POST /api/settings
POST /api/progress
GET  /api/cloud-data/:did
GET  /api/leaderboard
GET  /api/banks
GET  /api/bank/:id
GET/POST /api/announce
/api/admin/*
```

D1 绑定见：

```text
worker/wrangler.toml
```

## 常用命令

```bash
npm run dev       # 本地开发
npm run build     # 生产构建
npm run preview   # 预览构建产物
npm run lint      # ESLint 检查 js/
npm run lint:fix  # 自动修复部分 lint 问题
npm run format    # 格式化 JS/CSS/HTML
```

## 常见问题

### 题库加载失败怎么办？

1. 先确认 Worker API 是否正常：`https://ks-api.mutx.ccwu.cc/api/banks`
2. 如果 API 不可用，修复 Worker/D1 或检查 Cloudflare 服务状态；前端不会读取本地备份题库
3. 检查云端题库数据是否存在、启用且 JSON 格式合法

### 为什么不提交 dist？

Cloudflare Pages 会在部署时执行 `npm run build` 自动生成 `dist/`。提交 `dist/` 会造成仓库膨胀、冲突和部署结果不一致。

### 如何清空本地数据？

浏览器控制台执行：

```js
Storage.clearAll();
```
