# AGENTS.md

## 项目概述

城科卷王 - 支持多题库、代码高亮、数学公式

## 并发与资源纪律（强制）

本机 32GB 内存，曾因 16 个残留 `wrangler dev` 占满。所有代理必须遵守：

1. **一次只开一个**：同一时刻只允许一个开发任务、一个 Agent 动手；多任务排队串行，禁止并行开多路。
2. **本地服务只留一个**：`wrangler dev`、`vite`、`node`、`workerd`、`esbuild` 等开发服务，同一时刻最多一个实例，用完立即关闭；禁止后台常驻、禁止一个任务起多个实例。
3. **收工三件事**：关闭自己起的进程与后台 job、贴一次进程清单核对、报告剩余内存。看到别人的残留进程一并上报并清理。
4. **生产写操作一步一停**：迁移、导入、部署分开做，每步做完停下等验收，不并发、不叠加。
5. **测试最小化**：能只读就不写，能单实例就不多开，跑完立刻清理临时服务与 `.tmp/` 目录。

## 技术栈

- 前端：原生HTML/CSS/JavaScript（无框架）
- 构建：Vite
- 代码高亮：Prism.js
- 数学公式：KaTeX
- 部署：Cloudflare Pages + GitHub

## 项目结构

```
ks/
├── index.html              # 主页
├── quiz.html               # 刷题页面
├── css/
│   ├── base.css            # 基础样式
│   ├── home.css            # 主页样式
│   └── quiz.css            # 刷题页样式
├── js/
│   ├── app.js              # 主页逻辑
│   ├── quiz.js             # 刷题逻辑
│   ├── storage.js          # 本地存储管理
│   └── utils.js            # 工具函数
├── banks/                  # 本地题库备份目录（不参与前端运行时加载）
│   └── c-language.json     # C语言题库
├── worker/                 # Cloudflare Worker + D1 后端
│   ├── src/index.js        # API 入口
│   ├── schema.sql          # D1 表结构
│   └── wrangler.toml       # Worker 配置
├── 题库导入文档.md          # 题库格式说明
└── AGENTS.md               # 本文档
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（端口3000）
npm run dev

# 构建生产版本
npm run build
```

### 共享测试服务（强制）

本地 `wrangler dev` / `vite` 一律走统一入口，禁止裸跑：

```powershell
pwsh -File scripts/dev-services.ps1 -Action start -Owner "<你的名字>" -Task "<任务>"
pwsh -File scripts/dev-services.ps1 -Action status
pwsh -File scripts/dev-services.ps1 -Action stop
```

- 固定端口：api=8787、web=3000；端口被占**拒绝启动**，不自动换端口。
- 同一时刻最多一个实例；第二次 start 会被互斥锁 / lease 拒绝。
- 健康检查以 HTTP 为准（api `/api/banks` 200 且 `ok:true`；web `/` 200 且含页面标题）。
- 测试脚本先 `status` 探测，活着就复用，不要重复启动。
- 收工必须 `stop`，再贴 `status` 与进程核对。
- 涉及后台登录的测试必须传 `-ApiVar 'ADMIN_PASSWORD_HASH=<hash>'`（可多次，`KEY=VALUE` 或 `KEY:VALUE`）；不传时行为不变，脚本不保存、不打印任何值。admin 用例 403 时先核对 hash 与明文密码是否匹配。

## 添加新题库

生产环境题库只从 Cloudflare Worker/D1 加载，必须通过 `admin.html` 管理后台导入并启用云端题库。

`banks/*.json` 仅用于人工备份，不参与前端运行时加载，也不会作为 API 失败时的兜底来源；构建产物不复制 `banks/` 目录。

备份流程：

1. 按照 `题库导入文档.md` 格式编写 JSON 文件
2. 保存到 `banks/` 目录，如 `banks/new-bank.json`
3. 如需记录备份清单，可更新 `js/config.js` 的 `backupBankFiles`
4. 通过管理后台导入云端题库
5. 本地测试：`npm run dev`
6. 构建验证：`npm run build`

## 部署流程

### 自动部署（当前配置）

项目已配置 Cloudflare Pages 从 GitHub 自动部署：

1. 代码推送到 GitHub `main` 分支
2. Cloudflare Pages 自动拉取代码
3. 执行 `npm run build`
4. 部署到生产环境

### 手动触发部署

```bash
# 1. 确保代码已提交
git add -A
git commit -m "你的提交信息"

# 2. 推送到GitHub
git push origin main

# 3. Cloudflare会自动部署（约1-2分钟）
```

### 部署信息

- GitHub仓库：https://github.com/Mutx163/ks
- Cloudflare Pages 控制台：https://dash.cloudflare.com/29384b90082af8364a4570c7da0b0549/pages/view/ks
- Cloudflare Pages：https://ks-cjx.pages.dev
- 自定义域名：https://ks.mutx.ccwu.cc（需配置DNS）
- Worker API：https://ks-api.mutx.ccwu.cc

## 本地存储

用户数据存储在浏览器 localStorage：

- `quiz_progress` - 答题进度、逐题状态和累计时长
- `quiz_settings` - 用户设置
- `quiz_history` - 答题历史
- `quiz_bookmarks` - 收藏题
- `quiz_session` - 未完成刷题会话
- `quiz_recent_banks` - 最近使用题库
- `ks_sync_code` - 云同步码
- `ks_device_id` - 设备 ID

## 顾问模型(advisor)使用规则

遇到以下情况时，**必须**先调用 `advisor` 顾问模型获取指导，不要盲目硬闯：

1. **开始实质性工作前** — 写代码、改文件、提交之前，先问问 advisor
2. **遇到阻塞** — 错误反复、方案走不通、结果不对时
3. **需要决策** — 方案选型、方向确认、设计决策时
4. **变更方案** — 当前方法行不通，换路之前
5. **任务完成前** — 声明完成、推代码前，让 advisor 做最后把关

> 查文件、读代码、看状态不算「实质性工作」；写代码、做决定、下结论才算。

## 注意事项

1. **不要自动部署**：修改代码后本地测试，等用户明确要求再推送部署
2. **题库格式**：严格按照 `题库导入文档.md` 格式，特别是代码换行用 `\n`
3. **JSON规范**：题库JSON必须合法（可用 https://jsonlint.com 验证），引号要转义为 `\"`，换行用 `\n`
4. **不要盲目移除依赖**：`package.json` 中未在项目源码中 `import` 的依赖，不一定是死依赖——可能是 agent 工具链的运行时依赖（如 `@ff-labs/pi-fff` 是 pi 的搜索扩展）。移除前先确认其用途
5. **审查完成后询问下一步**：代码审查结束后，不要自行决定如何处理，应询问用户希望如何进行（如：自动修复、生成报告、手动确认后再改等）
6. **禁止并发堆放进程**：一次只跑一个任务，dev server 用完必关，收工前必须确认没有遗留的 node/workerd/esbuild 进程。

## 常见问题

### Q: 题库加载失败？
A: 检查JSON格式是否合法，字段是否完整

### Q: 代码显示不正确？
A: 确保代码块用 ` ```语言 ` 包裹，换行用 `\n`

### Q: 数学公式不显示？
A: 确保LaTeX语法正确，行内用 `$...$`，块级用 `$$...$$`

### Q: 如何清空用户数据？
A: 浏览器控制台执行 `Storage.clearAll()`
