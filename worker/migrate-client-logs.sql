-- 前端客户端日志表（控制台错误自动上报）
CREATE TABLE IF NOT EXISTS client_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,             -- 设备 UUID
    level TEXT NOT NULL DEFAULT 'log',   -- 日志级别: log/warn/error/info/debug
    type TEXT DEFAULT 'console',         -- 日志类型: console/uncaught/unhandledrejection/resource/user_report
    message TEXT DEFAULT '',             -- 日志消息（最长 1000 字符）
    stack TEXT DEFAULT '',               -- 调用堆栈（最长 2000 字符）
    page_url TEXT DEFAULT '',            -- 页面 URL（最长 500 字符）
    source TEXT DEFAULT '',              -- 错误来源（如文件名，最长 500 字符）
    line INTEGER DEFAULT 0,              -- 错误行号
    col INTEGER DEFAULT 0,               -- 错误列号
    ua TEXT DEFAULT '',                  -- User-Agent（最长 500 字符）
    created_at TEXT NOT NULL             -- 日志时间 ISO
);

CREATE INDEX IF NOT EXISTS idx_client_logs_device ON client_logs (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_logs_level ON client_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_logs_created ON client_logs (created_at DESC);
