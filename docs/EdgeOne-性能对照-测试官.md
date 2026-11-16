# EdgeOne vs Cloudflare 托管性能对照 — 测试官

日期：2026-11-16 21:2x–21:3x（本机，无代理、国内家庭宽带）
被测：`https://ks.mutx.ccwu.cc/`（EdgeOne，`Server: edgeone makers`，无 `cf-ray`）
对照：`https://ks-cjx.pages.dev/`（Cloudflare Pages，同一构建 `85f8041`）+ 切前同构建实测（11-15 在本机经 CF 自定义域）

## 1. 结论（先说不好听的）

1. **可用性：EdgeOne 完胜。** 同一时刻同一台机器，EdgeOne **8/8 成功**、TTFB 中位 **995 ms**；CF Pages **半数超时**（首页带稳定 URL 的 6 次里 3 次 10 s 超时，其余 4.5–8.2 s），带 `?cb=` 的 6 次虽然都回来了，但中位 **2,795 ms**、最差 6,844 ms。今天 CF 从这台机器基本属于“能打开但很慢/经常打不开”。
2. **延迟：EdgeOne 没有赢过昨天的 CF。** 切前（11-15）同一构建经 CF，页面 TTFB 实测 **356 / 659 / 704 ms**；今天 EdgeOne 的 HTML TTFB 中位 **约 1.0 s**。跨日对比不严谨，但方向清楚：**EdgeOne global 节点对国内没有“更近”的效果，反而略慢**。
3. **页面级 FCP 同样不占优**：EdgeOne 首页 FCP 中位 **2,824 ms**，切前 CF 同构建是 **1,376 ms**；刷题页 2,148 vs 1,452；只有后台 1,604 vs 2,168 更快（后台本来就被 jsdelivr 字体链拖累，CF/EdgeOne 两边都受影响）。
4. **所以这次迁移的收益是“能不能用”，不是“快了多少”。** 如果用户的体感目标是“明显更快”，当前数据不支持；如果目标是“国内能稳定打开”，今天的数据强力支持。

## 2. 口径

390×844、DPR 2、Fast 4G（1.6 Mbps / 750 Kbps / RTT 150 ms）、CPU 4×、冷缓存、3 次中位、全部带 `?cb=`；API 用 CDP 重写到本地 worker（生产零写入）。TTFB 另用 Node/curl 直接打 HTML，8 次取样。

## 3. TTFB 实测（今天，同机同网）

| 目标 | 成功 | TTFB 中位 | 取值范围 |
|---|---|---|---|
| EdgeOne（带 `?cb=`，全 miss） | **8/8** | **995 ms** | 599–8,132 ms（首个冷启动 8.1 s） |
| EdgeOne（稳定 URL） | **8/8** | **1,030 ms** | 399–1,811 ms |
| CF Pages（带 `?cb=`） | 6/6 | **2,795 ms** | 1,114–6,844 ms |
| CF Pages（稳定 URL） | **3/6（3 次 10 s 超时）** | 6,478 ms | 4,457–8,210 ms |

补充：`curl -4` 直连 CF 首页 **21.3 s 后失败**；`-6` 两边都无路由（本机 IPv6 当前不可用）。同网国内站点 TTFB 0.47–0.63 s（baidu/taobao），说明本机网络本身正常。

## 4. 六页（EdgeOne，今天，3 次中位）

| 页面 | 实际落点 | FCP | LCP | DCL | 传输 | 请求 |
|---|---|---|---:|---:|---:|---:|---:|
| `/` | 本页 | 2,824 | 2,824 | 2,915 | 122,499 B | 21 |
| `/quiz.html?bank=smoke-c&mode=all` | 本页（**无 clean-URL 跳转**） | 2,148 | 3,084 | 2,239 | 80,744 B | 13 |
| `/admin.html` | 本页 | 1,604 | 1,604 | 1,657 | 49,874 B | 8 |
| `/leaderboard.html` | **`index.html#/leaderboard`** | 1,748 | 1,748 | 2,221 | 173,702 B | 50 |
| `/analysis.html` | **`index.html#/analysis`** | 2,028 | 2,028 | 2,062 | 248,547 B | 59 |
| `/trend.html` | **`index.html#/trend`** | 1,936 | 1,936 | 2,515 | 248,599 B | 58 |

字节普遍低于 CF：CF 会在 HTML 里注入自家 `beacon.min.js`（约 10 KB），EdgeOne 没有；后台页请求数也从 12 降到 8。

## 5. 一处必须说清的行为差异

CF Pages 有 clean URL：`/leaderboard.html` 会被 308 成 `/leaderboard`，于是 `js/utils.js:853-859` 的「旧页跳 SPA」判断（看 `pathname` 是否以 `.html` 结尾）**不成立**，线上打开的是**独立页**（11–13 请求、53–57 KB）。
EdgeOne **不做 clean URL**，`.html` 原样保留，于是三页现在**真的跳 SPA 路由**（50–59 请求、173–249 KB）——与本地设计和基线一致。

所以上面三页的传输数字**不能和 CF 那批直接比**：不是变慢，是页面身份变了（独立页 → 完整 SPA）。这是 EdgeOne 带来的“行为修正”，不是回归；但对用户来说首屏请求数确实变多了，值得登记。

## 6. 功能链路（EdgeOne 线上真实环境，API 重写本地）

| # | 项 | 结果 |
|---|---|---|
| F1 | 首页题库加载 | PASS（3 库，本地 API） |
| F2 | 刷题页出题 | PASS（4 选项，题目正常） |
| F3 | 判题反馈 | PASS（2 处标记 + 答案解析） |
| F4 | 本地进度写入 | PASS（answered=1 / wrong=1 / questions=1） |
| F5 | 结果弹窗 | PASS（[32,184,326,475] 在视口内，按钮齐全） |
| F6 | 控制台错误 | PASS（0 条真实错误） |

全程 API 经 CDP 重写到 `127.0.0.1:8787`，**生产零写入**；未做注册/同步写操作。

## 7. 建议

- 如果目标是“国内稳定可用”：迁移达成，保留 EdgeOne；但**先把 AAAA 清理掉**——`ks.mutx.ccwu.cc` 目前仍有两条 Cloudflare 的 AAAA（`2606:4700:3033::6815:266a` / `2606:4700:3034::ac43:ddfe`），IPv6 用户会被导回 Cloudflare，等于一半用户没迁走。
- 如果目标是“快”：EdgeOne global 节点没能把 TTFB 压到 CF 昨天的水平。可选做法是换中国大陆节点（需 ICP 备案），否则延迟上不会有质变。
- 三页 SPA 化后请求数上升（50–59），值得前端评估是否用 `Input`/`Speculation Rules` 预取，或接受现状。

## 8. 收工

`stop` 后 `SERVICES_RUNNING=0`、`lease: none`、3000/8787 空闲；`node/workerd/esbuild = 0`；本机可用内存 **1.75 GB / 31.71 GB**（大头是用户程序，本轮未新增常驻进程）。未改业务代码、未 commit、未动 DNS。

证据：`.tmp-hosting/{probe.log,ttfb.log,edgeone-perf.log,edgeone-func.log}`、`.tmp-hosting/edgeone-func.json`、截图 `.tmp-hosting/shots/{edge-judged.png,edge-result-modal.png}`；切前 CF 数据见上一批 `.tmp-online/online-ab-final.json`。
