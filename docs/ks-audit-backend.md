# 城科卷王 · 后端只读体检报告（worker/ 与 /api 契约）

- 体检人：后端官
- 时间：2026-11-14
- 范围：`worker/src/index.js`（3074 行）、`worker/schema.sql`、`worker/migrations/*.sql`、`worker/migrate-client-logs.sql`、`worker/wrangler.toml`，以及 `js/` 中对 `/api/*` 的调用点（只读取证，不改前端）
- 方式：纯静态阅读 + 内存 SQLite 复现 DDL（`node:sqlite`，不连生产 D1、不写任何库）+ 线上只读 GET/OPTIONS 冒烟
- 约束遵守：未改业务代码、未 commit/push、未部署、未对生产 D1 做任何写入

---

## 一、路由与鉴权总览

`index.js` 共 **52 个路由分支**（`fetch` 内 `path === / startsWith / match` 判断）、**51 个 handler 函数**。

### 1.1 公开路由（16）

| 方法 | 路径 | 鉴权 | 成功 | 主要错误码 |
|---|---|---|---|---|
| OPTIONS | 任意 | 无 | 204 | — |
| POST | `/api/register` | 无 | 201 / 200（已注册） | 400、500 |
| POST | `/api/bind` | 仅 6 位同步码 | 200 | 400、404 |
| GET | `/api/user/:did` | 无 | 200（`ok:false` 表示未注册） | — |
| POST | `/api/sync` | deviceId → devices 反查 | 200 | 400（未注册/参数）、403（封禁） |
| POST | `/api/settings` | 同上 | 200 | 400、403 |
| POST | `/api/progress` | 同上 | 200 | 400、403 |
| POST | `/api/bookmarks` | 同上 | 200 | 400、403 |
| GET | `/api/cloud-data/:did` | 无（deviceId 即凭证） | 200 | — （`ok:false`） |
| GET | `/api/leaderboard` | 无 | 200 | — |
| GET | `/api/ai/config` | 无 | 200（Cache-Control 30s） | — |
| POST | `/api/ai/explain` | **无** | 200（流式 text/plain） | 400、403、500 |
| GET/POST | `/api/announce` | 无 | 200 | — |
| POST | `/api/logs` | 无（沿用 deviceId） | 200 | 400、500 |
| GET | `/api/banks` | 无 | 200（no-store） | — |
| GET | `/api/bank/:id` | 无 | 200（`public, max-age=300`） | 403（题库禁用）、404 |

### 1.2 管理员路由（36，全部 `/api/admin/*`）

鉴权统一走 `requireAdmin(deviceId, password, env)`（`index.js:1134-1151`）：
1. `deviceId` + `password` 都必须存在；`password` 做 SHA-256 后与 `env.ADMIN_PASSWORD_HASH`（回退到源码常量 `LEGACY_ADMIN_PASSWORD_HASH`，`index.js:1087-1088`）做恒定时间比较；
2. 再要求该 deviceId 绑定的用户 `is_admin=1`。
3. GET 请求允许用 Header `X-Admin-Password` / `X-Admin-Device-Id`，在 `index.js:85-90` 被复制进 query。
4. 失败统一 `403 {"error":"无权限"}`（不区分“密码错”和“不是管理员”，这一点是对的）。

| 分组 | 路由 |
|---|---|
| 用户 | `GET /api/admin/users`、`GET /api/admin/user-detail/:id`、`GET /api/admin/user-cloud-data/:id`、`POST /api/admin/update-user`、`POST /api/admin/ban-user`、`POST /api/admin/batch-ban`、`POST /api/admin/delete-user`、`POST /api/admin/reset-stats`、`POST /api/admin/adjust-stats`、`POST /api/admin/change-sync-code`、`POST /api/admin/remove-device` |
| 题库 | `GET /api/admin/banks`、`GET /api/admin/bank/:id`、`GET /api/admin/bank/:id/history`、`POST /api/admin/import-bank`、`POST /api/admin/upload-bank`、`POST /api/admin/create-bank`、`POST /api/admin/bank/:id/import-questions`、`POST /api/admin/bank/:id/question`、`PUT /api/admin/bank/:id/question/:qid`、`DELETE /api/admin/bank/:id/question/:qid`、`PUT /api/admin/bank/:id/settings`、`PUT /api/admin/bank/:id/toggle`、`DELETE /api/admin/bank/:id` |
| 公告 | `POST /api/admin/announce`、`GET /api/admin/announcements`、`POST /api/admin/delete-announcement`、`POST /api/admin/edit-announcement` |
| 系统 | `GET /api/admin/overview`、`GET /api/admin/activity`、`GET /api/admin/system-status`、`GET /api/admin/ai-config`、`PUT /api/admin/ai-config`、`GET /api/admin/operation-logs`、`POST /api/admin/operation-logs`、`GET /api/admin/logs` |

**鉴权覆盖核对**：36 个 `handleAdmin*` 函数中 35 个自行调用 `requireAdmin`；唯一例外 `handleAdminUserDetail`（`index.js:1179`，函数内注释“此函数不验证密码，由调用方保证”）由路由层 `index.js:176-178` 校验，当前无越权，但属**脆弱设计**：任何新路由复用该函数即越权。

---

## 二、schema.sql 与代码实际读写字段的差异

方法：内存库执行 `worker/schema.sql` 后用 `PRAGMA table_info` 取列清单，再与代码中全部 SQL 对列名的引用逐一比对。

| 表 | schema.sql 列 | 代码读 | 代码写 | 差异结论 |
|---|---|---|---|---|
| users | id, initials, created_at, created_device, settings, progress, bookmarks, last_sync_at, is_admin, banned | 全部读 | 全部写 | `created_device` **只写不读**（仅注册时 `index.js:615`），半死字段 |
| devices | device_id, user_id, device_name, bound_at | device_id, user_id | device_id, user_id, bound_at | `device_name` **代码零引用**（`grep device_name` 仅 schema 命中），死字段 |
| stats | user_id, bank_id, bank_name, answered, correct, duration, updated_at | 全部 | 全部 | 一致 |
| banks | id, name, description, category, version, question_count, questions_json, allowed_modes, enabled, created_at, updated_at | 全部 | 全部 | 一致 |
| bank_history | id, bank_id, action, detail, operator, snapshot, created_at | 除 snapshot | 除 snapshot | `snapshot` **零引用**（“快照（可选）”从未实现），死字段 |
| app_config | key, value, updated_at, updated_by | key, value | key, value, updated_at | `updated_by` **零引用**；且 `ensureAIConfigTable`（`index.js:2425-2435`）自建版本**没有** `updated_by` 列 → 双 DDL 形态不一致 |
| admin_operation_logs | 8 列 | 全部 | 全部 | 一致 |
| announcements | id, content, created_at | 全部 | 全部 | 一致 |
| client_logs | 12 列 | device_id, level, type, message, created_at, page_url, stack | 全部 11 列 | `ua / line / col / source` **写而不消费**（`SELECT cl.*` 会下发，但 `js/admin-client-logs.js` 不渲染，见验证 4） |

**反方向检查**：代码引用的列是否都存在于 schema —— 用 19 条关键 SQL 逐条 `prepare` 编译，全部 OK（见验证 2），未发现“读不存在的列”。

**双 DDL 源漂移（client_logs）**：`worker/schema.sql` 与 `worker/migrate-client-logs.sql` 都建 `client_logs`，但约束不同（见验证 3）：

| DDL 来源 | `device_id` 外键 | 索引 |
|---|---|---|
| schema.sql | 有 → `devices.device_id` | device、level、created、error_summary（4 个） |
| migrate-client-logs.sql | **无** | device、level、created（3 个，缺 error_summary） |

→ 先执行了 `migrate-client-logs.sql` 的库，`/api/logs` 对未注册设备**可用**且错误聚合查询**走全表扫描**；用 `schema.sql` 建的库则相反。行为取决于建库顺序。

---

## 三、迁移链问题

`worker/migrations/` 只有 0002、0003、0004，**没有 0001**（基线即 `schema.sql`），导致：

1. **0003 不可重放**：`ALTER TABLE users ADD COLUMN bookmarks` 在当前 `schema.sql`（已含 `bookmarks`）上执行 → `duplicate column name: bookmarks`（验证 1 实测 FAIL）。即“从零按 0002→0003→0004 顺序执行”这套流程在全新库上必挂。
2. 仓库内没有迁移状态记录（`schema.sql` 不建 `d1_migrations`；是否用过 `wrangler d1 migrations apply` 从仓库无法判断，迁移文件命名虽是 4 位序号但缺 0001），因此生产实际执行到哪一步**无法从代码判断**。
3. 0004 修的是“`substr` 前缀索引”，说明历史上出现过“`schema.sql` 初始化成功但最后一条 CREATE INDEX 报错”的事故 —— 修复方式是新增迁移补索引，而 `schema.sql` 里也已同步改好（两处一致，OK）。

---

## 四、错误码与响应封装现状

状态码分布（`error(...)` 调用统计）：**400 × 55、403 × 42、404 × 16、409 × 2、413 × 2、500 × 10**。

问题：

1. **两种错误信封并存**：`error()` 返回 `{"error": msg}`（`index.js:53`），但 `/api/logs` 返回 `{"ok":false,"error":...}`（`index.js:2833/2917`），前端只能靠 `res.ok` 判断。
2. **200 里塞业务失败**：`GET /api/user/:did` 未注册返回 `200 {ok:false,registered:false}`（`index.js:729`），`/api/cloud-data/:did` 返回 `200 {ok:false}`（`index.js:872/880`）。前端 `js/api.js:349/402` 依赖此形状，**改状态码会直接断前端**。
3. **403 一码多义**：无权限（管理端）、账号封禁（`/api/sync`）、题库禁用（`/api/bank/:id`，`index.js:1731`）、AI 未启用（`index.js:2627`）。前端 `js/api.js:212-225` 把**任何 403** 解释成 `{disabled:true}` 并提示“资源不可用” → 封禁用户同步失败时前端提示语是“资源不可用”而非“账号已封禁”，是**真实的用户可见缺陷**。
4. **缺 405**：方法不匹配一律落到 `404 {"error":"Not Found"}`（`index.js:376`）。
5. **内部错误信息外泄**：`handleAdminDeleteBank` 返回 `'删除失败: ' + e.message`（`index.js:1977`）；AI 相关三处同样拼接 `e.message`（`index.js:2503/2556/2602/2818`）。
6. **缺参数 → 500 而非 400**：`handleAdminResetStats`（`index.js:1237-1252`）与 `handleAdminUpdateUser`（`index.js:1255-1271`）都不校验 `targetUserId`，`bind(undefined)` 在 D1 会抛 `D1_TYPE_ERROR`（不支持 undefined 绑定），最终被最外层 catch 变成 `500 Internal Server Error`。
7. `POST /api/announce` 与 GET 同语义（`index.js:347`，注释说是为绕过网络限制），但会忽略 body；符合预期，仅文档需注明。

---

## 五、分页现状

| 接口 | 分页 | 上限 |
|---|---|---|
| `GET /api/leaderboard` | `limit` | 1–100（`Math.max(1, Math.min(n,100))`，`index.js:927`，实测 `limit=-1` → 只回 1 条，无全量导出风险，OK） |
| `GET /api/admin/operation-logs` | `page` + `pageSize` | pageSize ≤ 100，返回 `total` |
| `GET /api/admin/logs` | `limit` + `offset` | limit ≤ 200，返回 `total` |
| `GET /api/admin/activity` | 固定 | `LIMIT 50` |
| `GET /api/admin/announcements` | 固定 | `LIMIT 50` |
| `GET /api/admin/bank/:id/history` | 固定 | `LIMIT 50` |
| **`GET /api/admin/users`** | **无** | 返回**全站所有用户**（`index.js:1160-1173`，`SELECT ... FROM users GROUP BY u.id`，无 LIMIT） |
| `GET /api/admin/banks` | 无 | 按 stats 聚合，行数受题库数限制，可接受 |

→ 唯一硬伤是 `admin/users` 全量返回：用户量增长后响应体线性膨胀，且管理后台首屏 `js/admin.js:160` 直接吃全量。

---

## 六、限流与防滥用现状

| 入口 | 保护 | 评价 |
|---|---|---|
| 管理员登录/密码尝试 | `LOGIN_FAILS` 内存 Map，按 deviceId，8 次/15 分钟（`index.js:1109-1131,1136`） | **可绕过**：deviceId 由客户端自选，换一个就是全新计数；内存态在 Cloudflare 多 isolate / 冷启动下失效；Map 永不淘汰（内存缓慢增长） |
| `POST /api/logs` | DB 计数 100 条/设备/小时（`index.js:2846-2863`） | 有效但按可伪造 deviceId 计数；`client_logs` 无 TTL/清理任务，无限增长 |
| `POST /api/register` | 无 | 可批量注册刷 `users` 表 |
| `POST /api/bind` | 无 | **同步码枚举预言机**：存在 200 / 不存在 404 |
| `POST /api/sync` | 单次增量上限 answered ≤500、correct ≤500、duration ≤36000s（`index.js:759-767`） | 无请求频率上限、无日累计上限 → 可刷排行（该上限本身是好的防“一次请求刷满”） |
| `POST /api/ai/explain` | **无鉴权、无限流** | 消耗服务端全局 API Key；30s 超时、max_tokens 1024 只能限制单次成本 |
| `GET /api/banks`、`/api/bank/:id` | CDN 缓存（bank 5 分钟 / 列表 no-store） | 列表 no-store 是为“禁用立即生效”，代价是每次回源查 D1 |

---

## 七、问题清单（按优先级）

### P1（安全 / 可用性，建议下一阶段首批修）

**B-1 同步码是 6 位唯一凭证，且 `/api/bind` 无任何限流**（`index.js:634-720`、`390-401`）
- 6 位 × 32 字符表 ≈ 1.07e9 组合；`/api/bind` 用 404/200 直接区分码是否存在，无频率限制、无失败计数、无验证码。
- 一旦猜中即可把攻击者设备绑到该账号，随后 `GET /api/cloud-data/:did` 直接读到 settings/progress/bookmarks（`index.js:870-919`）。
- 兼容性影响：加限流/失败计数不改契约；若改成“绑定需二次确认”则需前端配合。**建议先做限流 + 失败计数，最小改动。**

**B-2 管理员登录限流可绕过**（`index.js:1109-1131, 1136`）
- 限速键是客户端可控的 `deviceId`，攻击者每请求换一个 deviceId 即无限尝试；内存 Map 在多实例下不共享。
- 兼容性影响：改为按 IP（`request.headers.get('CF-Connecting-IP')`）+ 全局限流，契约不变。

**B-3 `/api/ai/explain` 公开且无限流**（`index.js:2607-2820`）
- 无 deviceId/无登录要求即可触发服务端出钱调用上游模型（读 `app_config` 里的全局 Key）。
- 兼容性影响：加“需已注册 deviceId”或“每设备每小时 N 次”会改变前端调用（`js/aiExplain.js:653` 需带 deviceId）→ 需与前端官同批改。

**B-4 `/api/logs` 对“未注册设备”必然 500，且报错本身丢失**（`index.js:2829-2919`）
- `client_logs.device_id` 有外键指向 `devices.device_id`；`js/logCollector.js` 用的是本地 deviceId，**与是否注册无关**。实测（验证 3）未注册 deviceId 插入直接 `FOREIGN KEY constraint failed` → 被 catch 成 500。
- 后果：新用户/未注册用户（恰恰是最容易报错的人）控制台错误全部丢掉；前端还会反复重试。
- 兼容性影响：改为“deviceId 未注册则静默丢弃并返回 200 `{ok:true,dropped:n}`”即可，前端无需改。

**B-5 迁移链不可重放**（`worker/migrations/0003`，验证 1）
- 全新库按 0002→0003→0004 执行必挂 `duplicate column name: bookmarks`；无 0001 基线、无迁移状态表。
- 兼容性影响：仅运维流程，不动线上数据；建议补 `0001_init.sql` 基线并在 0003 加 `IF NOT EXISTS` 等价保护（SQLite 无 `ADD COLUMN IF NOT EXISTS`，需改为“先查 pragma 再 ALTER”的脚本，或明确“新库只跑 schema.sql，老库只跑 0003”）。

### P2（体验 / 可维护性 / 数据一致性）

**B-6 403 语义重载导致前端把“账号封禁”显示成“资源不可用”**（`index.js:774/815/837/859/1731/2627` + `js/api.js:212-225`）
- 兼容性影响：**不能直接改状态码**（前端按 403 判 disabled）；要么前端按 `error` 文案分支，要么后端为封禁改 401/423 —— 需前后端同批。

**B-7 `GET /api/admin/users` 无分页**（`index.js:1154-1176`）
- 兼容性影响：加分页需同步改 `js/admin.js:160/188/219` 三处。

**B-8 排行榜 `currentUser.rank` 恒按“答题数”计算，与 `sort=accuracy/duration` 不一致**（`index.js:993-1015`）
- 用户在“正确率榜”看到的“我的排名”其实是答题数排名。

**B-9 `currentUser.syncCode` 仍下发**（`index.js:981/1009`）
- 排行榜主体已刻意剥掉 syncCode（`index.js:958` 注释），但 `currentUser` 又把它带回来了；前端 `js/leaderboard.js:105-131` 只用 rank/initials/answered/accuracy/duration，**不下发不影响前端**。

**B-10 三处“只写不读”死字段**：`devices.device_name`、`bank_history.snapshot`、`users.created_device`（+ `app_config.updated_by`）
- 兼容性影响：D1 不支持 `DROP COLUMN` 的稳妥删列流程，建议先“标记废弃、代码不再写”，删列留下个迁移窗口。

**B-11 `app_config` 双 DDL 形态**（`schema.sql:79-84` vs `index.js:2425-2435`）
- 公开接口 `GET /api/ai/config` **每次请求都执行一次 `CREATE TABLE IF NOT EXISTS`**（`index.js:2464`）→ 无谓的写路径开销；且代码自建版本缺 `updated_by`。

**B-12 内部错误信息回给客户端**：`index.js:1977`（删除题库）、`2503/2556/2602/2818`（AI）

**B-13 缺参数返回 500**：`handleAdminResetStats`、`handleAdminUpdateUser`（详见四.6）

**B-14 题库题目写入缺少体积/字段校验**
- `handleAdminImportQuestions`（`index.js:2074-2078`）合并后不校验总大小：老库接近 2MB 时再导入会撞 D1 行上限，报错难懂（`import-bank`/`upload-bank` 有 1.8MB 校验，此路径没有）。
- `handleAdminAddQuestion`（`index.js:2096-2135`）不规范化、不校验，`question.question` 非字符串时 `.slice(0,50)` 抛异常 → 500（`index.js:2124`）。
- `handleAdminEditQuestion`（`index.js:2154`）整对象 merge，可写入任意字段（含覆盖 `questions_json` 语义）。三条都属后台输入校验问题，不影响现有数据。

**B-15 已注册用户同步的 3 个 JSON 大字段无体积上限**：`settings/progress/bookmarks` 直接 `JSON.stringify` 写 users 行（`index.js:818/840/862`），单行可被推到 D1 2MB 上限（无速率、无大小校验）。

**B-16 CORS 回退策略**：未知 Origin 不是拒绝，而是回显“白名单第一个”（`index.js:27`）。浏览器会因不匹配拦截，实际安全，但语义误导；另外 Pages **预览域名**（`xxx.ks-cjx.pages.dev`、新域名）不在白名单 → 预览环境跨域全挂（兼容风险）。

---

## 八、验证记录（可复核）

**验证 1 — 内存库执行 schema.sql + 迁移**
命令：`node .tmp-backend/schema-check.mjs`
```
schema.sql: OK
0002_admin_operation_logs.sql: OK
0003_add_bookmarks.sql: FAIL -> duplicate column name: bookmarks
0004_fix_client_logs_index.sql: OK
migrate-client-logs.sql: OK
```

**验证 2 — 19 条关键 SQL 在本 schema 上编译**：全部 `OK`（register/bind、stats upsert、settings/bookmarks/progress update、leaderboard、banks 列表、`INSERT OR REPLACE banks`、bank_history、admin_operation_logs、app_config upsert、client_logs insert/计数、admin users、admin logs join、change-sync-code 三表 update、delete-user）→ 未发现代码读 schema 之外的列。

**验证 3 — 外键与 DDL 差异**
```
6a 未注册 deviceId 写 client_logs: FAIL -> FOREIGN KEY constraint failed
6b REPLACE banks（已有 1 条 bank_history）: 成功     ← 说明 “INSERT OR REPLACE 会踩外键” 的猜测不成立
6c 不 defer 直接改 users.id: FAIL -> FOREIGN KEY constraint failed
6c defer_foreign_keys + 事务改主键: 成功             ← change-sync-code 的写法是正确且必要的
```
`client_logs` 两份 DDL 对比：`schema.sql` 有 `devices.device_id` 外键 + 4 索引；`migrate-client-logs.sql` 无外键 + 3 索引。

**验证 4 — 静态统计**
- 路由分支 52 / handler 51 / 路由层 dispatch 51 次（`/api/announce` 的 GET 与 POST 共用一个 dispatch，故分支比 dispatch 多 1）；其中 `handleAdmin*` 36 个、公开 15 个。`handleAdmin*` 里 35 个自校验，`handleAdminUserDetail` 靠调用方。
- 状态码：400×55、403×42、404×16、409×2、413×2、500×10。
- `snapshot|device_name|updated_by` 在 `worker/src/index.js` 仅 schema 命中（0 处代码引用）；`created_device` 仅 1 处写入。
- `js/admin-client-logs.js` 未引用 `log.ua / log.line / log.col / log.source`。

**验证 5 — 线上只读冒烟（2026-11-14，GET/OPTIONS）**
```
GET /api/banks                       200  acao=*                 cache=no-store
GET /api/bank/not-exist-xyz          404  {"error":"题库不存在"}
GET /api/announce                    200  {"ok":true,"announce":null}
GET /api/leaderboard?limit=-1        200  只返回 1 条（limit 夹紧生效）
GET /api/user/does-not-exist-device  200  {"ok":false,"registered":false}
GET /api/cloud-data/does-not-exist   200  {"ok":false}
GET /api/admin/logs  (无凭证)        403  {"error":"无权限"}
GET /api/admin/users (无凭证)        403  {"error":"无权限"}
GET /api/ai/config                   200  enabled:false（Cache-Control: public,max-age=30）
GET /api/unknown-route               404  {"error":"Not Found"}
OPTIONS /api/admin/users (evil Origin) 204 ACAO=https://ks.mutx.ccwu.cc
GET /api/bank/fixture-design-ch2     200  cache=public, max-age=300, 19340 bytes
```
题库现状：10 个库、启用 3 个（`fixture-design-ch2` 75 题、`fixture-design-practice` 120 题、`mechanical-control-fundamentals` 173 题），其余 7 个 `enabled:false`；`c-language-2026-code`/`precision-machining-review` 的 `allowed_modes=["review"]`。`/api/banks` 会**返回已禁用题库**（由前端过滤），这是既有契约，不宜改。

**未验证项（受“禁写库”约束）**
- POST 类接口的真实状态码/行为（register/bind/sync/settings/progress/bookmarks/logs/全部 admin 写接口）均未实测，结论来自代码与内存库语义。
- 生产 D1 实际表结构（是否有 `bookmarks` / `is_admin` 列、`client_logs` 有无外键）无法只读查证 → 2026-11-14 尝试过：本机 `wrangler 4.130.0` 已装，但 `wrangler whoami` 返回 `Not logged in. Your auth token has expired…`，且 `CLOUDFLARE_API_TOKEN` / `CF_API_TOKEN` 均未设置，`d1 execute --remote` **无法执行**。解封条件：提供 `CLOUDFLARE_API_TOKEN` 或在交互终端 `wrangler login`，然后跑 `wrangler d1 execute ks-leaderboard --remote --command "PRAGMA table_info(users)"`（纯读，无写入）。
  - 已用公开只读接口反推到的部分结论：`GET /api/banks` 200 → 生产 `banks` 的 8 个显式列齐全；`GET /api/leaderboard?sort=duration&stats=1` 200 → 生产 `users.banned`、`stats.updated_at` 存在（SQL 硬引用，缺列必 500）。
  - 仍无法证明：`users.bookmarks`、`users.is_admin`（公开 GET 路径都不触发这两列查询：`/api/cloud-data` 在 `resolveUser` 为 null 时早退，`requireAdmin` 在密码校验失败时早退）。
- `change-sync-code` 里 `PRAGMA defer_foreign_keys = ON` 放进 `env.DB.batch()` 是否被 D1 接受，未能在本地 Miniflare 之外验证（内存库证明该 PRAGMA + 事务写法本身正确）。

---

## 九、流程缺口

- `AGENTS.md` “顾问模型(advisor)使用规则”要求的 `advisor` 工具在本会话中不存在（可用工具列表无 `advisor`），本轮“开始工作前/完成前先问 advisor”的流程**无法执行**，已在报告中登记该缺口。
