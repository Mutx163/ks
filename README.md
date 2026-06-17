# 城科卷王

城科卷王是一个面向题库刷题、学习进度追踪和排行榜同步的多页面 Web 应用。

## 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                      宝塔面板服务器                          │
│                   Ubuntu / 8.135.36.100                     │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Nginx      │───▶│  Node.js     │───▶│   MySQL 5.7  │  │
│  │  (反向代理)   │    │  (Express)   │    │   (ks库)     │  │
│  │  :80/:443    │    │  :3001       │    │  :3306       │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│          │                                       │         │
│          ▼                                       │         │
│  ┌──────────────┐                               │         │
│  │  静态文件     │◀────── 前端 HTML/CSS/JS ──────┘         │
│  │ /www/wwwroot/ │                                         │
│  │ 127.0.0.1/   │                                         │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│     用户浏览器       │
│  a.mutx.ccwu.cc     │
└─────────────────────┘
```

## 在线地址

| 服务 | 地址 |
|------|------|
| 网站首页 | https://a.mutx.ccwu.cc |
| API 服务 | https://a.mutx.ccwu.cc/api/* |
| GitHub 仓库 | https://github.com/Mutx163/ks |
| Cloudflare Pages（备用） | https://ks-cjx.pages.dev |

## 服务器信息

| 项目 | 详情 |
|------|------|
| 服务器 | 宝塔面板 / Ubuntu |
| IP | 8.135.36.100 |
| Node.js | v26.3.0 |
| MySQL | 5.7.44 |
| Nginx | 宝塔内置 |
| PM2 进程名 | ks-api |
| API 端口 | 3001 |
| 数据库名 | ks |
| 数据库用户 | ks_user |

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript（ES Modules）
- **构建**：Vite 多页面构建
- **代码高亮**：Prism.js
- **数学公式**：KaTeX
- **图标**：Lucide
- **后端**：Express.js (Node.js)
- **数据库**：MySQL 5.7
- **反向代理**：Nginx
- **进程管理**：PM2
- **部署**：宝塔面板

## 项目结构

```
ks/
├── index.html              # 首页
├── quiz.html               # 刷题页
├── analysis.html           # 学习分析页
├── trend.html              # 学习趋势页
├── leaderboard.html        # 排行榜页
├── admin.html              # 管理后台
├── css/                    # 样式文件
├── js/                     # 前端逻辑
│   ├── api.js              # API 调用（自动切换服务器）
│   ├── config.js           # 前端配置
│   └── ...
├── banks/                  # 题库备份（不参与运行时）
├── worker/                 # Cloudflare Worker（备用）
│   └── src/index.js
├── server/                 # 宝塔服务器后端
│   ├── index.js            # Express API 入口
│   ├── db.js               # MySQL 连接池
│   ├── schema.mysql.sql    # 数据库表结构
│   ├── import-data.js      # 数据导入工具
│   └── README.md           # 部署文档
└── vite.config.js
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 预览构建产物
npm run preview
```

开发服务器默认：`http://localhost:3000`

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/register` | POST | 注册/获取同步码 |
| `/api/bind` | POST | 绑定设备 |
| `/api/user/:did` | GET | 获取用户信息 |
| `/api/sync` | POST | 同步数据 |
| `/api/settings` | POST | 保存设置 |
| `/api/progress` | POST | 保存进度 |
| `/api/cloud-data/:did` | GET | 获取云端数据 |
| `/api/leaderboard` | GET | 排行榜 |
| `/api/banks` | GET | 题库列表 |
| `/api/bank/:id` | GET | 题库详情 |
| `/api/announce` | GET/POST | 公告 |
| `/api/ai/explain` | POST | AI 解题（SSE） |
| `/api/admin/*` | * | 管理接口 |

## 前端 API 切换

前端 API 地址优先级：

```javascript
window.__API_BASE__ > localStorage.getItem('ks_api_base') > 'https://a.mutx.ccwu.cc'
```

切换回 Cloudflare（备用）：
```javascript
localStorage.setItem('ks_api_base', 'https://ks-api.mutx.ccwu.cc');
location.reload();
```

恢复宝塔服务器：
```javascript
localStorage.removeItem('ks_api_base');
location.reload();
```

## 服务器运维

```bash
# SSH 登录
ssh root@8.135.36.100

# 查看 API 日志
pm2 logs ks-api

# 重启 API
pm2 restart ks-api

# 查看进程状态
pm2 list

# 测试 API
curl https://a.mutx.ccwu.cc/api/health

# 查看 Nginx 配置
cat /www/server/panel/vhost/nginx/127.0.0.1.conf

# 查看 MySQL 数据
mysql -u ks_user -p'Ks@2024!Secure' ks -e "SELECT COUNT(*) FROM users;"
```

## 用户数据存储

浏览器本地数据保存在 localStorage：

| Key | 说明 |
|-----|------|
| `quiz_progress` | 答题进度、逐题状态、间隔复习数据、累计时长 |
| `quiz_settings` | 用户设置 |
| `quiz_history` | 答题历史 |
| `quiz_bookmarks` | 收藏题 |
| `quiz_session` | 未完成刷题会话 |
| `quiz_recent_banks` | 最近使用题库 |
| `ks_sync_code` | 云同步码 |
| `ks_device_id` | 当前设备 ID |

## 常用命令

```bash
npm run dev       # 本地开发
npm run build     # 生产构建
npm run preview   # 预览构建产物
npm run lint      # ESLint 检查
npm run format    # 格式化代码
```

## 常见问题

### API 连不上？

1. 检查 PM2 进程：`pm2 list`
2. 查看日志：`pm2 logs ks-api`
3. 测试本地：`curl http://127.0.0.1:3001/api/health`
4. 测试外网：`curl https://a.mutx.ccwu.cc/api/health`

### 数据库连不上？

1. 检查 MySQL 状态：`systemctl status mysql`
2. 测试连接：`mysql -u ks_user -p'Ks@2024!Secure' ks`
3. 查看进程：`pm2 logs ks-api | grep -i error`

### 如何回退到 Cloudflare？

```javascript
// 浏览器控制台
localStorage.setItem('ks_api_base', 'https://ks-api.mutx.ccwu.cc');
location.reload();
```

### 如何清空本地数据？

```javascript
// 浏览器控制台
Storage.clearAll();
```
