# EdgeOne 迁移备忘（2026-11-16）

> 只记事实与代价，供下次再碰 EdgeOne 时先看这一页，省一轮试错。

## 1. 关键结论：CLI 只能部署「直传」项目

`edgeone makers deploy` 的官方原文：

> Deploy your project to EdgeOne Makers. To use an existing project, it must be of the **direct upload type**.

实际报错（项目 `mutx163`，`Provider: Github`）：

```
[resolveLinkedProject] Project mutx163 exists but has Provider 'Github'.
This project type does not support direct folder or zip file deployment.
Only projects with Provider 'Upload' are supported.
```

→ **GitHub 导入类型的项目，CLI 永远部署不进去**，只能靠推仓库让平台构建。
→ 下次要 CLI 部署，**先查项目 Provider 类型，再决定装不装 CLI**。

## 2. CLI 的能力边界（v1.7.2 实测）

| 想要 | 是否可行 |
| --- | --- |
| 列出现有项目 | ✗ 没有 `list` 子命令；不带 `-n` 会进交互式提示「Input your EdgeOne Makers project name」，不列列表 |
| 用项目 ID 定位项目 | ✗ `link -n pages-xxxx` 报 `PROJECT_NOT_FOUND`，只认项目名 |
| 关闭访问签名校验 / 设为公开 | ✗ 没有 `--public` / `--access` / `--domain` 之类开关；`access-control` 全包只有 dev server 的 CORS 头 |
| 拿到预览签名链接 | ✗ 签名是服务端行为（`DescribePagesEncipherToken` + `PresetDomain`，URL 形如 `?eo_token=…&eo_time=…`），CLI 只打印裸域名 |
| 查自定义域名验证状态 | ✗ CLI 有 `CustomDomains` API 类但无对应命令 |

`link` 可用参数：`-n/--name`、`--mode auto|link_existing|create_upload`、`--expected-workspace`、`--json`。
`deploy` 可用参数：`[directoryOrZip]`、`-n`、`-t`、`-e production|preview`、`-a global|overseas`、`--json`、`--anonymous`、`--site china|global`。

## 3. 默认域名的两种形态（由服务端返回，本地无法预判）

- 项目**未绑自定义域名** → 返回 `"type":"preset"`、`"isTld":0`，域名是预览域（`*.edgeone.cool` / `*.edgeone.dev`），**所有请求需带 `eo_token`+`eo_time` 签名，否则 401**
- 项目**已绑自定义域名且验证生效** → 返回 `"type":"custom"`，`url` 是 `https://<自定义域名>`

401 的响应头特征：`X-EOP-MSG: eo_time missing`，报错页提示「Site Owner: Click "Preview" in the console for a new link」。

## 4. 本次踩到的顺序死结

1. 想让 EdgeOne 接管 `ks.mutx.ccwu.cc`，但先不切 DNS（保留回滚余地）
2. 不切 DNS → 自定义域名无法完成 CNAME 验证 → 一直是「待验证」→ 访问 401
3. 预览域能访问但需签名，CLI 拿不到签名链接 → 只能人在控制台点 Preview

**破法（未执行）**：先在项目里加一个子域名 `cn.mutx.ccwu.cc`，在 Cloudflare 加对应 CNAME 并**关闭小黄云（DNS only）**，让 EdgeOne 终结 TLS。子域验证生效后即可用真实自定义域名验证六个入口，主域 `ks.mutx.ccwu.cc` 解析全程不动。验完再切主域，出问题删掉 `cn` 记录即可。

## 5. 本次实际发生的污染（已清理）

`edgeone makers link` 会在仓库根写 `.edgeone/project.json`（项目关联）和空的 `.env`。前者已删除并把 `.edgeone/` 加入 `.gitignore`；后者 0 字节且已被 `.env` 规则忽略。

## 6. 与 CORS 的关系

最终要切的域名是 `ks.mutx.ccwu.cc`，它**本来就在 Worker `ALLOWED_ORIGINS` 白名单里**，所以切过去不需要改 Worker、不需要再部署 Worker。只有换用其他域名（如 `cn.mutx.ccwu.cc` 直接当主站访问、或 Makers 预览域）才需要扩白名单。

## 7. 线上校验基线与截图口径（2026-11-17 更新）

- 首页响应体基线：撤除页头图形标识后为 **19,851 字符**（此前约 20,882）。判据统一为「>15000 且六个页面 title 正确」，不要再拿 20,800 当阈值——那会把正常页面误判成被截断
- 校验必须带 cache-buster（`?cb=`），并且先校验响应体大小再比对指纹
- **截图必须是真机式模拟**：`chrome --headless --screenshot --window-size=390,844` 属于桌面模式，不会应用 `width=device-width` 的移动布局，量出来的卡片会看起来超出视口；正确做法是用 CDP `Emulation.setDeviceMetricsOverride({width:390,height:844,deviceScaleFactor:2,mobile:true})`，再用 `Page.captureScreenshot`
- 复核横向溢出以 DOM 为准：`document.documentElement.scrollWidth` 应等于 `window.innerWidth`（本次 390=390，卡片 rect 为 l=24/r=366，无溢出）
