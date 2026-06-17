# 城科卷王 - 宝塔服务器部署指南

## 📋 概述

本目录包含将城科卷王 API 从 Cloudflare Worker 迁移到宝塔服务器（MySQL）的完整方案。

**迁移策略：保留 Cloudflare Worker 作为回退方案**

---

## 🚀 快速部署步骤

### 第一步：导出 D1 数据

在项目根目录运行：

```bash
# 进入 worker 目录
cd worker

# 使用 wrangler 导出数据
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM users" > ../server/d1-export/users.json
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM devices" > ../server/d1-export/devices.json
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM stats" > ../server/d1-export/stats.json
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM banks" > ../server/d1-export/banks.json
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM announcements" > ../server/d1-export/announcements.json
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM bank_history" > ../server/d1-export/bank_history.json
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM app_config" > ../server/d1-export/app_config.json
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM admin_operation_logs" > ../server/d1-export/admin_operation_logs.json
npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM client_logs" > ../server/d1-export/client_logs.json
```

或者运行导出脚本：
```bash
cd server
node export-d1.js
```

### 第二步：宝塔 MySQL 配置

1. **登录宝塔面板**
2. **安装 MySQL**（如果未安装）
   - 软件商店 → 搜索 MySQL → 安装
3. **创建数据库**
   - 数据库 → 添加数据库
   - 数据库名：`ks`
   - 用户名：`ks_user`（或自定义）
   - 密码：设置一个强密码
   - 字符集：`utf8mb4`

4. **导入表结构**
   ```bash
   # 在宝塔终端执行
   mysql -u ks_user -p ks < /www/wwwroot/ks/server/schema.mysql.sql
   ```

5. **导入数据**
   ```bash
   # 复制 d1-export 目录到服务器
   # 然后执行
   cd /www/wwwroot/ks/server
   npm install
   node import-data.js
   ```

### 第三步：部署 Node.js 后端

1. **安装 Node.js**
   - 宝塔 → 网站 → Node 项目 → 版本管理
   - 安装 Node.js 18.x 或更高版本

2. **上传代码**
   - 将 `server/` 目录上传到宝塔网站根目录
   - 例如：`/www/wwwroot/ks/server/`

3. **配置环境变量**
   ```bash
   cd /www/wwwroot/ks/server
   cp env.example .env
   # 编辑 .env 文件，填入数据库密码
   ```

4. **安装依赖**
   ```bash
   cd /www/wwwroot/ks/server
   npm install
   ```

5. **启动服务**
   
   **方法一：直接运行（测试用）**
   ```bash
   node index.js
   ```
   
   **方法二：使用 PM2（生产推荐）**
   ```bash
   npm install -g pm2
   pm2 start index.js --name ks-api
   pm2 save
   pm2 startup  # 设置开机自启
   ```

### 第四步：配置 Nginx 反向代理

在宝塔中：

1. **网站设置**
   - 网站 → 你的网站 → 设置 → 反向代理

2. **添加反向代理**
   - 代理名称：`ks-api`
   - 目标 URL：`http://127.0.0.1:3001`
   - 发送域名：`$host`
   
3. **或者手动编辑 Nginx 配置**
   ```nginx
   location /api/ {
       proxy_pass http://127.0.0.1:3001;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

### 第五步：切换前端 API 地址

**方法一：浏览器控制台切换（临时测试）**
```javascript
// 切换到宝塔服务器
localStorage.setItem('ks_api_base', 'https://your-domain.com');
location.reload();

// 切回 Cloudflare Worker
localStorage.removeItem('ks_api_base');
location.reload();
```

**方法二：修改代码（永久切换）**
编辑 `js/api.js` 第 14 行：
```javascript
BASE_URL: 'https://your-domain.com',  // 改为你的宝塔域名
```

**方法三：HTML 注入（推荐）**
在 `index.html` 和 `quiz.html` 的 `<head>` 中添加：
```html
<script>window.__API_BASE__ = 'https://your-domain.com';</script>
```

---

## 🔄 回退方案

如果宝塔服务器出问题，随时可以切回 Cloudflare：

```javascript
// 浏览器控制台执行
localStorage.removeItem('ks_api_base');
location.reload();
```

或者删除 HTML 中的 `<script>window.__API_BASE__ = ...</script>`

---

## 📁 文件结构

```
server/
├── index.js          # Express API 服务器（主程序）
├── db.js             # MySQL 连接配置
├── schema.mysql.sql  # MySQL 建表语句
├── export-d1.js      # D1 数据导出脚本
├── import-data.js    # 数据导入 MySQL 脚本
├── package.json      # 依赖配置
├── env.example       # 环境变量示例
├── d1-export/        # D1 导出的数据（运行 export 后生成）
└── README.md         # 本文档
```

---

## 🔧 API 对照表

| 接口 | Cloudflare Worker | Express (宝塔) |
|------|------------------|----------------|
| 健康检查 | - | `GET /api/health` |
| 注册 | `POST /api/register` | 相同 |
| 绑定设备 | `POST /api/bind` | 相同 |
| 查询用户 | `GET /api/user/:did` | 相同 |
| 同步答题 | `POST /api/sync` | 相同 |
| 同步设置 | `POST /api/settings` | 相同 |
| 同步进度 | `POST /api/progress` | 相同 |
| 同步收藏 | `POST /api/bookmarks` | 相同 |
| 获取云端数据 | `GET /api/cloud-data/:did` | 相同 |
| 排行榜 | `GET /api/leaderboard` | 相同 |
| 题库列表 | `GET /api/banks` | 相同 |
| 题库详情 | `GET /api/bank/:id` | 相同 |
| 公告 | `GET /api/announce` | 相同 |
| AI 配置 | `GET /api/ai/config` | 相同 |
| AI 解读 | `POST /api/ai/explain` | 相同 |
| 管理员接口 | `GET/POST /api/admin/*` | 相同 |

所有 API 接口保持完全一致，前端无需修改任何代码逻辑。

---

## ⚠️ 注意事项

1. **数据库字符集**：必须使用 `utf8mb4`，否则中文和 emoji 会乱码
2. **JSON 字段**：`progress` 和 `questions_json` 使用 `MEDIUMTEXT` 类型
3. **时区**：MySQL 连接设置了 `+08:00` 时区
4. **外键约束**：表之间有外键关系，删除数据时注意顺序
5. **索引**：已创建必要的索引，查询性能与 D1 一致

---

## 🐛 常见问题

### Q: 连接数据库失败？
A: 检查 `.env` 文件中的数据库配置，确保 MySQL 服务已启动

### Q: 中文乱码？
A: 确保数据库字符集为 `utf8mb4`，连接也使用 `utf8mb4`

### Q: 导入数据失败？
A: 检查 JSON 文件格式，确保是有效的 JSON 数组

### Q: 前端无法访问 API？
A: 检查 Nginx 反向代理配置，确保 `/api/` 路径正确转发

---

## 📊 性能对比

| 指标 | Cloudflare D1 | 宝塔 MySQL |
|------|---------------|------------|
| 响应延迟 | 50-200ms | 10-50ms（本地） |
| 并发能力 | 自动扩展 | 取决于服务器配置 |
| 数据备份 | Cloudflare 管理 | 手动/自动备份 |
| 成本 | 免费额度 | 服务器费用 |

---

## 🔐 安全建议

1. **修改管理员密码**：在 `index.js` 中修改 `ADMIN_PASSWORD_HASH`
2. **限制数据库权限**：为应用创建专用数据库用户，只授予必要权限
3. **启用 HTTPS**：在宝塔中配置 SSL 证书
4. **定期备份**：设置 MySQL 自动备份
5. **防火墙**：只开放必要端口（80, 443, 22）

---

## 📞 技术支持

如有问题，请检查：
1. Node.js 控制台日志
2. MySQL 错误日志
3. Nginx 错误日志
4. 浏览器开发者工具网络请求

---

**迁移完成！享受更稳定、更快速的 API 服务 🎉**
