# AGENTS.md

## 项目概述

智能刷题系统 - 支持多题库、代码高亮、数学公式

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
├── banks/                  # 内置题库目录
│   ├── c-language.json     # C语言题库
│   └── engineering-mechanics.json  # 工程力学题库
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

## 添加新题库

1. 按照 `题库导入文档.md` 格式编写JSON文件
2. 保存到 `banks/` 目录，如 `banks/new-bank.json`
3. 编辑 `js/app.js`，在 `builtinBanks` 数组中添加文件名：

```javascript
builtinBanks: [
    'c-language.json',
    'engineering-mechanics.json',
    'new-bank.json'  // 新增
],
```

4. 本地测试：`npm run dev`

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
- Cloudflare Pages：https://ks-cjx.pages.dev
- 自定义域名：https://ks.mutx.ccwu.cc（需配置DNS）

## 本地存储

用户数据存储在浏览器 localStorage：

- `quiz_banks` - 题库数据
- `quiz_progress` - 答题进度
- `quiz_settings` - 用户设置
- `quiz_history` - 答题历史

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
3. **JSON验证**：题库JSON必须合法，可用 https://jsonlint.com 验证
4. **代码转义**：JSON中的引号 `"` 要转义为 `\"`，换行用 `\n`

## 常见问题

### Q: 题库加载失败？
A: 检查JSON格式是否合法，字段是否完整

### Q: 代码显示不正确？
A: 确保代码块用 ` ```语言 ` 包裹，换行用 `\n`

### Q: 数学公式不显示？
A: 确保LaTeX语法正确，行内用 `$...$`，块级用 `$$...$$`

### Q: 如何清空用户数据？
A: 浏览器控制台执行 `Storage.clearAll()`
