# 城科卷王 · 健康体检报告（只读基线）

- 日期：2026-11-14
- 对象：`C:\cursor\ks`（GitHub `Mutx163/ks`，HEAD `18e95cc`）
- 线上：主站 `https://ks.mutx.ccwu.cc`（Pages 默认域 `https://ks-cjx.pages.dev` 仅作记录）｜API `https://ks-api.mutx.ccwu.cc`
- 范围：前端（html/css/js）、后端（worker/ 与 /api 契约）、题库（banks/、public/images/、scripts/）、构建与关键链路、Git 与环境
- 约束：全程只读。未改业务代码、未 commit/push、未部署、未写生产 D1；临时脚本与截图只在 `.tmp-*/`，本报告与四份分域报告只在 `docs/`
- 分域原始报告：`docs/体检-前端官.md`、`docs/ks-audit-backend.md`、`docs/体检-题库官.md`、`docs/体检-测试官.md`、`docs/体检-情报官.md`

---

## 0. 结论摘要

1. **没有 P0**：四域均未发现「功能完全不可用或数据永久丢失」级缺陷。
2. **门禁全绿**：`npm run lint` 与 `npm run build` 均 EXIT=0；本地关键链路 20/20 PASS；线上 6 个页面入口与核心 API 全部 200；生产 D1 零写入。
3. **线上跑的就是当前 HEAD**：线上入口资源哈希与本地构建逐一对齐（`index-DdjOsYLA.js`、`quiz-DAFujzKd.js`、`admin-DBO5xvSg.js`、`leaderboard-B5mHdyqE.js`），主域名与 Pages 默认域内容哈希一致。
4. **P1 共 16 条已确认（另 1 条待验证）**，按主题归为六类：
   - 用户可见（5）：主题被云端旧值覆盖、收藏按钮不亮且「收藏模式」加载 0 题整条不可用、fixture-design-ch2 少 12 道图片题、23 道简答无参考答案、10 道题缺解析字段。
   - 数据可信度（2）：重新开始重复计入排行榜、错题清零后队列残留且增量越滚越大（同一根因：`/api/sync` 非幂等）。
   - 安全（3）：6 位同步码零限流、管理员登录限流可绕过、`/api/ai/explain` 公开无限流。
   - 可观测性（1）：`/api/logs` 对未注册设备必 500，新用户报错全丢。
   - 性能（1）：首屏按 hash 重复初始化、重复 autoSync。
   - 基础设施/维护（4）：迁移链不可重放、dev 直连生产 API、5 条 5 个月前的旧 stash、线上库无本地备份。
   - 无法验证（1）：生产 D1 远程 schema 因 wrangler 未登录/无 API Token 查不了；公开接口只能证明 `users.banned`、`stats.updated_at` 存在，`users.bookmarks`/`is_admin` 无法证明（见 E-2）。
5. **用户视角的题库口径**：线上共 10 库 1217 题，但**只有 3 库启用、368 题对用户可见**（fixture-design-ch2 75 + fixture-design-practice 120 + mechanical-control-fundamentals 173）。其中 fixture-design-ch2 线上少 12 道图片题（本地 87 vs 线上 75），是唯一让用户直接感到「题少了」的问题。
6. **最重要的结构性问题**：`/api/sync` 是增量累加语义，前端 `statsCursor` 语义又与它不匹配 → 排行榜数据不可信；而「加幂等」被不可重放的迁移链卡住（`migrations/0003` 在全新库上必挂），所以「修迁移基线」不是清洁活，是幂等改造的前置条件。另：生产 D1 远程 schema 本次**无法验证**（wrangler 未登录、无 API Token），若真缺 `users.bookmarks`，收藏接口对全网直接 500，该条应升到路线图第一位（见 E-2）。
7. **流程缺口**：`AGENTS.md` 强制要求的 `advisor` 工具在本环境不可用，本轮全部结论未经顾问复核。

---

## 1. 基线与环境

### 1.1 Git 基线

| 项 | 值 | 证据 |
| --- | --- | --- |
| 分支 / HEAD | `main` / `18e95cc` | `git rev-parse HEAD` |
| 与远端 | `origin/main` 同为 `18e95cc`，`0  0` | `git rev-list --left-right --count HEAD...origin/main` |
| 提交数 / 末次提交 | 368 / `2026-11-13 20:13:22 +0800` | `git log -1` |
| 工作树 | 仅 `?? docs/` | `git status --porcelain` |
| 备份分支 | `backup-main-before-reset-20260619-093259` @ `0e5364b` | `git branch -vv` |
| 旧 stash | 5 条，均 2026-06-06 | `git stash list --date=iso` |

stash 明细（全部过期，建议在第 3 阶段决定去留）：

| stash | 内容 | 判断 |
| --- | --- | --- |
| `stash@{0}` `@{1}` `@{2}` | 仅未跟踪的 `js/admin-logs.js` / `js/admin-status.js`（现均已入库） | 重复，可丢 |
| `stash@{3}` | `js/admin-banks.js`(+303/−80)、`js/admin-editor.js`(3 行) | 6 月旧补丁，`HEAD..stash@{3}` 跨 115 文件 |
| `stash@{4}` | `admin.html`、`js/admin-users.js`、`js/admin.js` + 未跟踪 `js/admin-ui.js`（工作区已不存在、全仓无引用） | 6 月旧补丁 + 悬空文件 |

### 1.2 依赖与环境

- Node `v24.19.0`、npm `11.17.0`，engines `>=22.13 <25` 满足
- vite 6.4.2、eslint 10.4.0、prettier 3.8.3、katex 0.16.9、lucide 0.344.0、marked 15.0.7、prismjs 1.29.0、@ff-labs/pi-fff 0.9.4；`npm ls --depth=0` 无 UNMET/extraneous
- 没有新增依赖、未改 `package.json`

### 1.3 仓库结构（tracked 103 文件）

| 目录 | 文件数 | 职责 |
| --- | ---: | --- |
| `js/` | 35（31 业务模块 15,084 行 + 4 vendor shim 169 行） | 首页/刷题/后台/AI/存储/同步 |
| `css/` | 7（10,182 行） | base/home/quiz/admin/leaderboard/insights/theme-modern |
| `worker/` | 7 | 单文件 API `src/index.js`（3074 行）+ schema + 迁移 |
| `banks/` | 11 json + 1 `.bak` | 人工备份题库，共 1412 题 |
| `scripts/` | 2 py | 题库构建/OCR 导入 |
| `public/` | 12 png | `public/images/fixture-design-ch2/` |
| 根 HTML | 6 | index/quiz/analysis/trend/leaderboard/admin |

### 1.4 线上部署一致性

- `dist/` 99 文件、4,551,165 字节（≈4.34 MiB），已被 `.gitignore:2` 忽略，未入库
- 线上 HTML 的 `/assets/*` 引用与本地 `dist/` 完全一致；`ks.mutx.ccwu.cc` 与 `ks-cjx.pages.dev` 首页内容哈希同为 sha12 `46CD122C8181`
- 结论：线上 = HEAD `18e95cc` 的构建，无隐藏旧版本

### 1.5 遗留物

| 路径 | 规模 | 状态 |
| --- | ---: | --- |
| `.tmp-test/` | 40 文件 / 8.0 MB | 本轮测试产物，ignore |
| `.tmp-kongzhi/` | 46 文件 / 3.1 MB | 本轮题库审计 + 历史主题截图，ignore |
| `.tmp-backend/` | 3 文件 / 11 KB | 本轮后端校验脚本，ignore |
| `.tmp-theme-test/` | 2 文件 / 40 KB | 主题视觉脚本，ignore |
| `reviews/` 30 份、`revdoc/` 5 份 | 370 KB | 2026-06-19 旧报告，ignore 但仍可被检索 |
| `sk.txt`、`questions_to_explain.txt`、`skills/`、`skills-lock.json` | 约 34 KB | **已入库的杂物** |

---

## 2. 前端域

### 2.1 页面入口与挂载

| 入口 | 挂载 | 状态 |
| --- | --- | --- |
| `index.html` | `js/app.js` + `leaderboard.js` + `insights.js` + `debug.js` | 有效，4 视图 SPA 容器 |
| `quiz.html` | `js/quiz.js`（core/renderer/answers/nav Facade） | 有效 |
| `admin.html` | `js/admin.js` + `admin-*.js` | 有效 |
| `analysis.html` / `trend.html` / `leaderboard.html` | `insights.js` / `leaderboard.js` | **死页面**：`js/utils.js:803-809` 一律 `location.replace('index.html#/…')`，UI 双实现 |

`vite.config.js:7-12` 扫描根目录全部 `.html` 作为构建入口，6 个都会产出（3 个死页面也参与构建）。

### 2.2 主题系统（data-theme × data-color）

- 两轴：`data-theme`(auto/light/dark) × `data-color`(parchment/white/modern)，层叠守卫完整：`base.css:284/329/2136`、`theme-modern.css:11/76/133`，`auto+white+系统深色` 不串色
- 恢复逻辑 5 份拷贝：`index.html:8-37`、`quiz.html:8-37`、`leaderboard.html:9-36`（死页面）、`js/app.js:1631-1640`、`js/insights.js:53-61`
- 刷题页无主题入口（`quiz.html:63-106`、`quiz-nav.js:543-700`）；后台不加载现代主题（`admin.html:13-14`）
- `analysis.html` / `trend.html` 无 FOUC 前置脚本

### 2.3 localStorage 数据流

- `Storage.KEYS`（`js/storage.js:14-21`）6 个键 + 散落键 `ks_sync_code`/`ks_initials`/`ks_device_id`/`ks_last_pull`/`ks_sync_queue`/`ks_is_admin`/`ks_cached_announce`/`quiz_bank_sort`/`quiz_shortcuts_shown`/`quiz_welcome_shown`/`admin_pwd`
- 写：`updateQuestionProgress`（SM-2，`storage.js:224-264`）、`addDuration`/`addBankDuration`（415-430）、`setStatsCursor`（211-222）、`addHistory`（403-413，上限 100）、`toggleBookmark`（381-391）、`saveSession`（583-588）
- 读：首页统计（`app.js:537+`）、quiz 恢复（`quiz-core.js:185-267`）、insights（`insights.js:76-81`）
- 清：`clearAll`（`storage.js:621-635`）漏清 `ks_initials`、`quiz_bank_sort`、`quiz_shortcuts_shown`、`quiz_welcome_shown`、`admin_pwd`、`quiz_*.corrupt.*`
- 会话字段白存：`filterType`/`answerMode` 写入（`quiz-core.js:284-285`）但 restore 不读（219-266）

### 2.4 P1 问题

| 编号 | 问题 | 证据 | 影响 |
| --- | --- | --- | --- |
| F-1 | 主题/配色只写本地、不推云端，且拉取时云端优先覆盖 | `app.js:1121-1134`、`1288-1292` 只 `Storage.updateSettings`；`pushSettings` 仅 3 处（`app.js:1506`、`quiz-nav.js:659`、`api.js:495`）；`api.js:456-462` 用 `{...local, ...cloud}` | 切深色后下次同步被改回旧值，刷新退回；多设备主题永不同步 |
| F-2 | 「重新开始」把同一批作答重复计入云端 | `quiz-nav.js:293-303` → `storage.js:301-314` 把 `statsCursor` 归零（`:310`）→ `quiz-nav.js:156-175` 全量 `pushStats`；后端 `worker/src/index.js:781-786` 是累加 SQL | 排行榜答题数/时长虚高，重刷即虚增 |
| F-3 | 错题清零后增量非法 → 同步队列永久残留 | `storage.js:348-368` 减 `answered` 不动游标 → `quiz-nav.js:437-445` 算出 `dAnswered≤0` 而 `dCorrect>0` → 后端 `index.js:765-767` 返回 400 → `quiz-nav.js:462-471` 置脏重试 | 该题库统计停更；`syncQueue.js:59-64` 把增量累加到同一条、`115-118` 失败项放回 remaining、`141` 落盘残留 → **永久残留 + 每次同步事件重发一次**，数值越滚越大，修好后会一次性灌入 |
| F-4 | 首屏按 hash 重复初始化、重复云同步 | `index.html:388-389` 同时挂 leaderboard/insights；`leaderboard.js:237-246`、`insights.js:573-585` 模块尾部自初始化；`utils.js:908-930` Router 再调一次 | `#/leaderboard` 跑两遍 `autoSync`（pull+push+flush）；`#/analysis` 先 trend 后 analysis 重渲染 |
| F-5 | 收藏按钮不亮，且「收藏模式」整条不可用（数字/字符串 id 不一致） | `quiz-renderer.js:156` 传数字 `question.id`；`storage.js:393-395` 用 `Array.includes`（SameValueZero，非 `===`）；落库为字符串 `"1"`；`quiz-core.js:413-414` 的 `bookmarkIds.includes(q.id)` 同样恒 false | 点「收藏(N)」进 `quiz.html?mode=bookmark` 加载 0 题，按 `quiz-core.js:128-133` 提示「没有收藏的题目」退回首页 → **用户可见·功能缺失**；数字 id 调 `toggleBookmark` 还会重复 push |

> F-3 的定性以「后端官实测 + 测试官链路」为准：不是死循环，是「队列永久残留 + 每次同步事件重发」；重发本身不写 D1（400 早于 `resolveUser`），真正写 D1 的是 `logCollector` 抓到的 `console.warn`，受 100 条/设备/小时限流。

### 2.5 P2 问题（12 条，详见 `docs/体检-前端官.md`）

| 编号 | 问题 | 位置 |
| --- | --- | --- |
| F-P2-1 | 3 个死页面仍参与构建，排行榜 UI 双实现 | `utils.js:803-809`、`vite.config.js:7-12` |
| F-P2-2 | 主题恢复逻辑 5 处拷贝 | 见 2.2 |
| F-P2-3 | 刷题页无主题入口 | `quiz.html:63-106`、`quiz-nav.js:543-700` |
| F-P2-4 | 后台不跟主题 | `admin.html:13-14` |
| F-P2-5 | 死代码 `renderResult`（全仓无调用） | `quiz-nav.js:180-291` vs `117-178` |
| F-P2-6 | 不可达分支 | `quiz-core.js:128-138` |
| F-P2-7 | `updateQuestionProgress` 缺结构守卫，可能首答 TypeError | `storage.js:224-232`、`api.js:730-731` |
| F-P2-8 | 设置弹窗两份实现 | `app.js:1357-1526` vs `quiz-nav.js:543-700` |
| F-P2-9 | `clearAll` 漏清 6 类键 | `storage.js:621-635` |
| F-P2-10 | 会话存了不恢复的字段 | `quiz-core.js:284-285` |
| F-P2-11 | `backupBankFiles` 全仓无 import | `js/config.js:3-15` |
| F-P2-12 | `?debug=1` 从 unpkg 动态加载 eruda（无 SRI/版本锁） | `js/debug.js:11-23` |

---

## 3. 后端 / API 域

### 3.1 路由与鉴权

- `worker/src/index.js` 共 **52 个路由分支 / 51 个 handler**：分支 = 管理员 36 + 公开 16（含 OPTIONS）；`return await handle*` dispatch 51 次（`/api/announce` 的 GET/POST 共用一行）；handler = admin 36 + 公开 15（全部 `/api/admin/*`）
- 管理员鉴权：`requireAdmin`（`index.js:1134-1151`）——`deviceId` + SHA-256 密码与 `ADMIN_PASSWORD_HASH` 恒定时间比较，再要求 `is_admin=1`；失败统一 403（不区分密码错/非管理员，做法正确）
- 脆弱点：36 个 `handleAdmin*` 中 35 个自校验，`handleAdminUserDetail`（`index.js:1179`）靠路由层 `index.js:176-178` 校验，当前无越权，但任何新路由复用它即越权

### 3.2 schema.sql 与代码读写字段差异

| 表 | 差异 | 结论 |
| --- | --- | --- |
| users | `created_device` 只写不读（仅注册 `index.js:615`） | 半死字段 |
| devices | `device_name` 代码零引用 | 死字段 |
| stats | 与代码一致 | OK |
| banks | 与代码一致 | OK |
| bank_history | `snapshot` 零引用 | 死字段（快照从未实现） |
| app_config | `updated_by` 零引用；`ensureAIConfigTable`（`index.js:2425-2435`）自建版本无该列 | 双 DDL 形态不一致 |
| client_logs | `ua/line/col/source` 写而不消费（随 `SELECT cl.*` 下发，但 `js/admin-client-logs.js` 不渲染）；且两份 DDL 约束不同 | 见 3.3 |
| 反向检查 | 19 条关键 SQL 在本 schema 上全部编译通过 | 未读到不存在列 |

### 3.3 迁移链与 D1 漂移

- `worker/migrations/` 只有 0002/0003/0004，**没有 0001 基线**；无迁移状态表，生产执行到哪一步无法从代码判断
- **0003 不可重放**：`node .tmp-backend/schema-check.mjs` 实测 `0003_add_bookmarks.sql: FAIL -> duplicate column name: bookmarks`（当前 `schema.sql` 已含该列）
- `client_logs` 双 DDL：`schema.sql` 有 `devices.device_id` 外键 + 4 索引；`migrate-client-logs.sql` 无外键 + 3 索引 → 行为取决于建库顺序
- 未注册 deviceId 写 `client_logs` 实测 `FOREIGN KEY constraint failed`
- **生产 D1 远程 schema：无法验证（凭证缺失），不是「无漂移」**。测试官仅在本地旧实例发现 `users` 缺 `bookmarks/is_admin/banned`；后端官尝试生产只读 PRAGMA 时 `wrangler whoami` 返回 `Not logged in. Your auth token has expired…`，且无 `CLOUDFLARE_API_TOKEN`/`CF_API_TOKEN`，`d1 execute --remote` 无法执行。
  - 公开只读接口可反推的部分：`GET /api/banks` 200 → 生产 `banks` 8 个显式列齐全；`GET /api/leaderboard?sort=duration&stats=1` 200 → 生产 `users.banned`、`stats.updated_at` 存在（SQL 硬引用，缺列必 500）
  - **仍无法证明 `users.bookmarks` / `users.is_admin`**：公开 GET 不触发这两列（`/api/cloud-data` 在 `resolveUser` 为 null 时早退，`requireAdmin` 在密码校验失败时早退）
  - 若生产真缺 `users.bookmarks`，`/api/bookmarks` 会直接 500 → 严重度高于已登记的 P1；本节按「待验证/高影响」登记，不升级为确认项
  - 解封条件：ks 提供 `CLOUDFLARE_API_TOKEN`，或交互终端 `wrangler login`，随后执行纯读命令 `wrangler d1 execute ks-leaderboard --remote --command "PRAGMA table_info(users)"`；该结论也影响 B-4 的修复方式

### 3.4 错误码 / 分页 / 限流

- 状态码统计：400×55、403×42、404×16、409×2、413×2、500×10
- 两种错误信封并存：`error()` 返回 `{"error":msg}`，`/api/logs` 返回 `{"ok":false,...}`；`/api/user/:did`、`/api/cloud-data/:did` 在 200 里返回 `ok:false`（前端 `js/api.js:349/402` 依赖，不能直接改）
- **403 一码多义**：无权限 / 封禁 / 题库禁用 / AI 未启用；前端 `js/api.js:212-225` 把所有 403 当 `{disabled:true}`，封禁用户看到「资源不可用」
- 缺 405：方法不匹配一律 404；内部错误信息外泄（`index.js:1977`、AI 四处）；缺参返 500（`index.js:1237-1252`、`1255-1286`，`bind(undefined)` 落在 `1273-1276`）
- 分页：leaderboard limit 1–100（`index.js:927`，`limit=-1` 实测只回 1 条）、admin operation-logs/logs 有上限；**`GET /api/admin/users` 无分页返回全站用户**（`index.js:1154-1176`）
- 限流：管理员登录按客户端自选 deviceId、内存 Map 8 次/15 分钟（可绕过）；`/api/logs` 100 条/设备/小时；register/bind/ai/explain 无限流

### 3.5 `/api/sync` 语义与幂等评估（路线图依据）

- **当前是增量累加，不是覆盖**：`index.js:777-798` 的 upsert 为 `answered = stats.answered + excluded.answered`（correct/duration 同理）；单次增量上限 answered≤500、duration≤36000（759-767），`correctDelta > answeredDelta` 直接 400
- 加幂等不破坏老客户端/老数据，但**没有任何列能存轮次**（stats/users 都无）；要么加列（迁移），要么绝对值覆盖（会破坏跨设备累加，不推荐）
- 推荐两步：① **紧急**：把 765-767 的 400 改成 `correctDelta = Math.min(correctDelta, answeredDelta)` 并返回 200（约 3 行、零迁移、老客户端无感），F-3 的残留条目立即能发出并被清掉；② **正式**：`/api/sync` 加可选 `roundId`、`stats` 加 `last_round_id`（1 个迁移 + worker 约 15 行 + 前端传 UUID），老客户端不带 roundId 行为不变
- 前置：先补迁移基线 0001，否则无法安全加 0005（见 3.3）
- 边界（避免路线图误读）：① 紧急 clamp **只消除 F-3 的永久残留，不解决 F-2 的重开重复累加**，F-2 仍需 roundId/游标语义；② roundId 上线后**已写入 D1 的脏数据不会自动回滚**（累加语义已落库），路线图必须保留「人工校正 / 接受现状」决策点
- 幂等方案已在内存库验证：`ALTER TABLE stats ADD COLUMN last_round_id TEXT NOT NULL DEFAULT ''` 成功，老行默认空、行为不变

### 3.6 P1 问题

| 编号 | 问题 | 证据 | 兼容性影响 |
| --- | --- | --- | --- |
| B-1 | 同步码 6 位唯一凭证，`/api/bind` 零限流，404/200 暴露码是否存在 | `index.js:634-720`、`390-401` | 加限流/失败计数不改契约；二次确认需前端配合 |
| B-2 | 管理员登录限流按客户端自选 deviceId、内存态 | `index.js:1109-1131` | 改按 `CF-Connecting-IP`，契约不变 |
| B-3 | `/api/ai/explain` 公开、无限流，可烧服务端全局 Key | `index.js:2607-2820` | 加 deviceId 校验需前端 `js/aiExplain.js:653` 同批改 |
| B-4 | `/api/logs` 对未注册设备必然 500（外键），新用户报错全丢 | `index.js:2829-2919`；实测 `FOREIGN KEY constraint failed` | 改静默丢弃返回 200，前端零改动 |
| B-5 | 迁移链不可重放，0003 在新库必挂 | `schema-check.mjs` 输出 | 运维流程问题；卡住幂等改造 |

### 3.7 P2 问题（11 条，详见 `docs/ks-audit-backend.md`）

B-6 403 语义重载（封禁显示成「资源不可用」，不能直接改码）｜B-7 `admin/users` 无分页｜B-8 排行榜 `currentUser.rank` 恒按答题数（与准确率/时长榜不符）｜B-9 `currentUser.syncCode` 仍下发（前端不用，可安全去掉）｜B-10 4 个只写不读死字段｜B-11 `/api/ai/config` 每次 GET 执行 DDL、自建版本缺 `updated_by`｜B-12 内部错误信息回客户端｜B-13 缺参返 500｜B-14 题库题目写入缺体积/字段校验（`handleAdminImportQuestions` 无 1.8MB 校验）｜B-15 settings/progress/bookmarks 无体积上限｜B-16 CORS 未知 Origin 回显白名单第一个、预览域名不在白名单

---

## 4. 题库域

### 4.1 JSON 合法性与题数

- 11 个 JSON 全部 `json.loads` 通过（无 BOM/尾随逗号/编码问题），合计 **1412 题**；11 个库 id 互不重复，库内题目 id 无重复
- 题型：单选 876、判断 292、简答 145、编程 75、填空 14、多选 10
- 逐库：c-language-2026-code 63｜c-language-basics 238｜cnc-machine 155｜fixture-design-ch2 87｜fixture-design-practice 120｜cnc-machining-full-2026 159｜precision-machining-review 22｜manufacturing-fundamentals 38｜mechanical-control-fundamentals 173｜precision-machining 310｜cnc-machining-comprehensive-2026 47

### 4.2 本地备份 vs 生产 D1（`GET /api/banks` 200）

| 题库 id | 本地 | D1 | enabled | 结论 |
| --- | ---: | ---: | :---: | --- |
| c-language-2026-code | 63 | 63 | false | 一致 |
| c-language-basics | 238 | 237 | false | 本地多 1 题 |
| fixture-design-ch2 | 87 | 75 | **true** | **本地多 12 题（id 76–87 图片题）** |
| fixture-design-practice | 120 | 120 | **true** | 一致 |
| cnc-machining-full-2026 | 159 | 159 | false | 一致 |
| manufacturing-fundamentals | 38 | 38 | false | 一致 |
| mechanical-control-fundamentals | 173 | 173 | **true** | 一致 |
| precision-machining-review | 22 | 22 | false | 一致 |
| precision-machining | 310 | 310 | false | 一致 |
| cnc-machine | 155 | — | — | D1 无（旧备份） |
| cnc-machining-comprehensive-2026 | 47 | — | — | D1 无（旧备份） |
| electromechanical-transmission-memorize-supplement | — | 20 | false | **线上有、本地无备份** |

- D1 合计 10 库 **1217 题**（与 `/api/banks` 逐库相加一致），本地 11 库 1412 题
- **用户视角：3 库启用 = 368 题可见**（75+120+173）；其余 7 库 disabled 不对用户展示
- 本地备份覆盖 10 个线上库中的 9 个；2 个本地库线上已不存在

### 4.3 字段抽检

- 必有字段 1412/1412 齐全，`category` 全落在各库清单内
- `explanation` 缺 10 道（gemini-code-1780672768438 id 144–153）：题目**没有 `explanation` 键**，原文 `"explanation": null` 出现 0 次
- `answer` 为空 23（c-language id 68–71、146–148、192–197、227–236，均 essay）
- 答案合法性：单选 876/876 落在 A–D；多选无越界；判断为布尔；填空答案数与 `___` 一致（唯一例外 c-language q7）
- 额外字段：`source` 439、`memoryAid` 301、`sourceId` 275、`tags` 250、`codeLanguage` 74、`img` 24（12 个为空串）

### 4.4 代码块 / 公式 / 图片（PASS）

- 含代码块 85/1412，围栏全部成对，无「换行写成字面量 `\n`」双重转义
- `$` 公式全部成对，无未闭合
- `public/images/` 12 张 PNG 共 2.4 MB；题库引用 12 处全部存在，无外链；`ch2-p057` 与 `ch2-p058` SHA256 相同（实际 11 张不同图）
- 引用图片的题是本地 id 76–87，**这 12 题未进 D1**：线上 fixture-design-ch2 的 75 题中引用图片题为 0，而 12 张图已构建进 `dist/images/`

### 4.5 `backupBankFiles`

- `js/config.js:3-15` 列 11 个文件，与 `banks/` 下 11 个 `.json` 一一对应
- 但全仓无任何代码 import 它 → 只是注释性清单，无自动校验
- `banks/c-language.before-image-import.bak`（7,417 B）不在清单，不参与流程

### 4.6 P1 / P2

| 编号 | 问题 | 证据 |
| --- | --- | --- |
| Q-1 | 23 道简答参考答案为空串 | c-language.json 上述 id |
| Q-2 | 10 道题缺 `explanation` 字段（原文无该键，非 null） | gemini-code-1780672768438 id 144–153 |
| Q-3 | fixture-design-ch2 12 道图片题未进 D1，而线上 enabled=true | 线上 75 题/引用图片 0 vs 本地 87 题 |
| Q-4 | 线上库 electromechanical（20 题）无本地备份 | `/api/banks` 有、`banks/` 无 |

P2（8 条）：4 个文件名与题库 id 不符（c-language→c-language-basics 等）｜c-language q7 填空无 `___`｜shukon 题目 id 不连续｜12 个空 `img`｜`banks/` 遗留 `.bak`｜`source`/`sourceId`/`allowed_modes` 未进格式文档、文档写 version 为字符串而 D1 是整数｜3 份数控题库并存、78 组跨库重复题干｜precision-machining 7 组同题干答案矛盾（该库未启用）

---

## 5. 构建与链路域

### 5.1 门禁实跑

| 项 | 结果 | 证据 |
| --- | --- | --- |
| `npm run lint` | **PASS**，0 error / 0 warning（`--max-warnings 0`） | EXIT=0，`.tmp-test/lint.log` |
| `npm run build` | **PASS**，1509 modules，3.45s，6 个 HTML 入口全部产出 | EXIT=0，`.tmp-test/build.log` |
| `dist/` | 被 `.gitignore:2` 忽略，未入库 | `git check-ignore -v dist` |

### 5.2 本地关键链路（20/20 PASS）

环境：vite:3000 + `wrangler dev --local` 独立库 `.tmp-test/d1`（`smoke-c` 题库起始 12 题，跨多轮冒烟累计随后台导入增至 15 题；第 18 步为 14→15），管理员密码用测试哈希；CDP 拦截把 113 次 `/api` 请求全部重写到 `127.0.0.1:8788`，**生产 D1 零写入**。

链路：首页加载 → 未注册闸门 → 注册 → 进刷题 → 答错/答对/解析 → 收藏 → 完成（50%，progress/history 落盘）→ 首页进度/错题本 → 云同步拉取+推送 → 排行榜出现本账号 → 后台登录（9 tab）→ 批量导入 1 题（14→15）→ 移动端 390×844 两页无横向溢出；三套主题即时生效 + 持久化 + 刷新恢复。

- 结果：`.tmp-test/ui-results.json`；截图 11 张 `.tmp-test/shots/`（`01-home-desktop-parchment.png`、`04-theme-modern-dark.png`、`08-admin-desktop.png`、`10-home-mobile.png` 等）
- 全程 `console.error` 0、未捕获异常 0、失败请求 0

### 5.3 线上只读

主域名 3 个页面 + 3 个 API 全 200（明细见第 6 节与 `docs/体检-测试官.md` 第五节），生产写操作 0。

### 5.4 覆盖缺口（下一阶段补）

只覆盖单选判题，多选/判断/填空、背题、错题重做、考试模式、间隔复习未跑；生产后台真实登录未验证（用本地注入哈希）；多设备同步冲突、换绑清空、SyncQueue 重试未测；弱网/离线未测；只测 Chromium headless；大数据量未压测。

---

## 6. 线上可用性快照（2026-11-14）

| URL | 状态 | 关键字段 |
| --- | ---: | --- |
| `https://ks.mutx.ccwu.cc/` | 200 | title=城科卷王；与 Pages 默认域内容哈希一致（sha12 `46CD122C8181`） |
| `/quiz.html` | 200 | 9,726 B |
| `/analysis.html` | 200 | 3,818 B（客户端重定向 `index.html#/analysis`） |
| `/trend.html` | 200 | 4,013 B（同上） |
| `/leaderboard.html` | 200 | 20,920 B（同上） |
| `/admin.html` | 200 | 9,840 B |
| `https://ks-api.mutx.ccwu.cc/api/banks` | 200 | `ok:true`，10 库 / 3 启用 / 1217 题，`no-store` |
| `/api/leaderboard` | 200 | 33 条，榜首 LYT 9579；字段 rank/isMe/initials/answered/correct/accuracy/duration/lastActive |
| `/api/announce` | 200 | `{"ok":true,"announce":null}` |
| `/api/bank/fixture-design-ch2` | 200 | 75 题 |
| `/api/bank/does-not-exist` | 404 | `{"error":"题库不存在"}` |
| `/api/nope` | 404 | `{"error":"Not Found"}` |

备注：主域 HTML 无 `Strict-Transport-Security`；`ks-api.mutx.ccwu.cc/` 根路径 404 属预期（Worker 无根路由）。

---

## 7. 风险清单

> 「影响面」为初判，供第 3 阶段排序；P2 只列要点，完整清单见各分域报告。

### 7.1 P0

无。

### 7.2 P1（已确认 16 条，另 1 条待验证）

| 编号 | 问题 | 影响面（初判） | 证据 |
| --- | --- | --- | --- |
| F-1 | 主题被云端旧值覆盖，多设备不同步 | 用户可见·体验 | `app.js:1121-1134/1288-1292`、`api.js:456-462/489-501` |
| F-2 | 「重新开始」重复计入排行榜 | 数据可信度 | `quiz-nav.js:293-303`、`storage.js:310`、`index.js:781-786` |
| F-3 | 错题清零后队列永久残留、增量越滚越大 | 数据可信度·同步 | `storage.js:348-368`、`index.js:765-767`、`syncQueue.js:59-64/115-118/141` |
| F-4 | 首屏重复初始化、重复 autoSync | 性能·云请求 | `index.html:388-389`、`utils.js:908-930` |
| F-5 | 收藏按钮不亮 + 「收藏模式」加载 0 题不可用 | 用户可见·功能缺失 | `quiz-renderer.js:156`、`storage.js:393-395`、`quiz-core.js:413-414` |
| B-1 | 同步码唯一凭证且 `/api/bind` 零限流 | 安全·账号接管 | `index.js:634-720/390-401` |
| B-2 | 管理员登录限流可绕过 | 安全 | `index.js:1109-1131` |
| B-3 | `/api/ai/explain` 公开无限流 | 安全·成本 | `index.js:2607-2820` |
| B-4 | `/api/logs` 未注册设备必 500 | 可观测性 | `index.js:2829-2919` |
| B-5 | 迁移链不可重放（0003） | 运维·阻塞幂等 | `schema-check.mjs` 实测 |
| Q-1 | 23 道简答无参考答案 | 用户可见·内容 | c-language.json id 68–71… |
| Q-2 | 10 道题无解析 | 用户可见·内容 | gemini-code… id 144–153 |
| Q-3 | fixture-design-ch2 少 12 道图片题（线上启用） | 用户可见·题量 | 线上 75 vs 本地 87 |
| Q-4 | 线上 electromechanical 库无本地备份 | 数据恢复 | `/api/banks` vs `banks/` |
| E-1 | dev 直连生产 API | 开发·数据安全 | `js/api.js:15`、`logCollector.js:244/375/417` |
| E-2 | 生产 D1 远程 schema **无法验证**（wrangler 未登录、无 API Token）；若缺 `users.bookmarks` 则 `/api/bookmarks` 直接 500 | 待验证·高影响 | 本地旧库 PRAGMA 实测；公开 GET 只能证明 `banned`/`stats.updated_at` 存在 |
| E-3 | 5 条 2026-06-06 旧 stash | 维护·误操作 | `git stash list` |

> E-2 为「无法验证项」，不计入已确认的 16 条；若拿到 Cloudflare 凭证确认缺列，升级为最高优先级并改为确认项。

### 7.3 P2（要点）

- 前端 12 条（死页面双实现、主题恢复 5 份拷贝、死代码 `renderResult`、`clearAll` 漏清键、eruda 无 SRI 等）
- 后端 11 条（403 语义重载、`admin/users` 无分页、排行榜 currentUser 排名口径、syncCode 下发、4 个死字段、每次 GET 建表、错误信息外泄、缺参 500、题目写入无校验、JSON 大字段无上限、CORS 回退）
- 题库 8 条（文件名与 id 不符、填空占位缺失、id 不连续、空 `img`、`.bak` 遗留、格式文档缺口、3 份数控库并存 78 组重复题干、precision-machining 7 组答案矛盾）
- 环境 5 条（根目录杂物入库存、旧报告过期、主域无 HSTS、`.tmp-*` 累计约 11 MB、README/AGENTS 域名口径需统一）

---

## 8. 四份报告的矛盾与裁定

1. **「无限重试」定性**：按后端官实测 + 测试官链路，采纳「队列永久残留 + 每次同步事件重发一次，且 `syncQueue.js:59-64` 把增量累加到同一残留条目、`141` 落盘、数值越滚越大」；前端报告的「无限重试」改为上述表述，不再写成死循环。
2. **收藏高亮 P1**：前端官报告未覆盖，已按测试官证据 + 前端官复核补入 F-5；`storage.js:393-395` 实为 `Array.includes`（SameValueZero），且 `quiz-core.js:413-414` 同因导致「收藏模式」加载 0 题，影响面改为**功能缺失**。
3. **本地 D1 缺列**：测试官只证明本地旧实例漂移；生产远程 schema 因 wrangler 未登录且无 API Token **无法验证**，只登记为「待验证/高影响」（若缺 `users.bookmarks`，`/api/bookmarks` 对全网直接 500），不下结论；解封条件见 3.3。
4. **题数口径**：1217（D1 逐库相加）与 368（3 库启用、用户可见）不冲突；报告统一写「线上 10 库 1217 题，其中 3 库启用、368 题对用户可见」，fixture-design-ch2 单库 75/87 差异单独列 Q-3。

---

## 9. 证据索引

| 类别 | 位置 |
| --- | --- |
| 分域报告 | `docs/体检-前端官.md`、`docs/ks-audit-backend.md`、`docs/体检-题库官.md`、`docs/体检-测试官.md`、`docs/体检-情报官.md` |
| 独立抽检 | `docs/抽检-测试官.md`（23 条跨域核验表 + 4 条偏差）、`.tmp-test/verify-claims.json`、`verify-claims2.json` |
| 题库审计产物 | `.tmp-kongzhi/bank-audit.json`、`.tmp-kongzhi/issues.txt`、`bank_audit.py`/`escape_check.py`/`dup_check.py`/`field_census.py` |
| 后端内存库验证 | `.tmp-backend/schema-check.mjs`、`fk-check.mjs`、`roundid-check.mjs` |
| 测试脚本与结果 | `.tmp-test/cdp-lib.mjs`、`smoke-ui.mjs`、`seed.mjs`、`probe.mjs`、`ui-results.json`、`lint.log`、`build.log` |
| 截图 | `.tmp-test/shots/`（11 张，含 `01-home-desktop-parchment.png`、`04-theme-modern-dark.png`、`08-admin-desktop.png`、`10-home-mobile.png`） |
| 线上快照 | 本报告第 6 节；GET/OPTIONS 实测记录见 `docs/ks-audit-backend.md` 验证 5 |

关键命令：

```powershell
git status -sb; git log -1; git rev-list --left-right --count HEAD...origin/main; git stash list --date=iso
node .tmp-backend/schema-check.mjs      # 0003 FAIL duplicate column
node .tmp-backend/roundid-check.mjs     # last_round_id 迁移可行性
python .tmp-kongzhi/bank_audit.py       # 11 JSON / 1412 题
npm run lint; npm run build             # 均 EXIT=0
Invoke-WebRequest https://ks.mutx.ccwu.cc/ -UseBasicParsing
Invoke-RestMethod https://ks-api.mutx.ccwu.cc/api/banks
```

---

## 10. 流程缺口

`AGENTS.md:113-123` 要求「实质性工作前/完成前必须调用 advisor」；本环境不存在 `advisor` 工具，本轮五份报告与汇总均未经顾问复核。建议在第 3 阶段明确该规则是删除、替换还是保留为人工复核点。

---

## 11. 复核记录

| 成员 | 复核范围 | 状态 |
| --- | --- | --- |
| 前端官 | 第 2 节事实与行号（含 F-5 补入、模块数口径） | 已核对：F-5 升级为功能缺失、模块数改 31/4/35（15,253 行）、F-P2-8 改 `1357-1526`、F-3 精确到 `59-64/115-118/141`，已并入 |
| 后端官 | 第 3 节事实、3.3 生产 D1 结论、B-1–B-5 | 已核对：计数改 36/35、52/51/51 口径、`client_logs` 改「写而不消费」、缺参 500 改 `1255-1286`、E-2 改「无法验证」、3.5 补两条边界，已并入 |
| 题库官 | 第 4 节数字与 368/1217 口径 | 已核对：32 项数字/清单一致；`explanation` 由 null 改为「缺键」，已并入 |
| 测试官 | 第 5 节门禁与链路、F-5/E-1 归位 | 已抽检：23 条跨域，19 一致 / 4 偏差（36/35、缺 explanation 键、dist 4.3 MiB、5.2 跨轮口径），已并入；记录见 `docs/抽检-测试官.md` |

---

> 下一阶段路线图（2026-11-14）：[docs/roadmap-2026-11-14.md](roadmap-2026-11-14.md)
