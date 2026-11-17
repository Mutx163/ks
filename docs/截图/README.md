# 页头与后台登录页截图（2026-11-17）

用途：撤除页头图形标识（`b34c949`）后的线上视觉留证。全部取自生产 `https://ks.mutx.ccwu.cc`，带 cache-buster。

| 文件 | 视口 | 内容 |
| --- | --- | --- |
| `m-home.png` | 390×844，DPR 2（CDP `mobile:true`） | 首页页头，纯文字「城科卷王」左对齐，无图形标识 |
| `m-admin.png` | 390×844，DPR 2（CDP `mobile:true`） | 后台登录卡片，「PRODUCTION ADMIN」胶囊为卡片首元素，无 58px 图标残影 |
| `home-desktop.png` | 1280×900 | 首页桌面版，导航居中、右侧按钮未被挤动 |
| `admin-desktop.png` | 1280×900 | 后台登录页桌面版，卡片垂直居中 |

实测数据（CDP `Emulation.setDeviceMetricsOverride`）：`scrollWidth = innerWidth = 390`，卡片 rect `l=24 / r=366 / w=342`，无横向溢出；`card.t=247` 与 `kicker.t=276` 相差 29px，即卡片 padding 34px 减 kicker 自身 margin，无多出的空白。

截图口径见 `docs/EdgeOne-迁移备忘.md` 第 7 节：手机截图必须用 CDP 移动模拟，`chrome --headless --screenshot --window-size=390,844` 属于桌面模式，不应用 `width=device-width`，量出来的卡片会像溢出（本次两张错图已删，仅保留本目录四张正确图）。
