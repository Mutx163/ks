-- 用户表（同步码为核心标识）
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                -- 同步码（6位，如 KW3A7F）
    initials TEXT NOT NULL,             -- 姓名首字母 (1-4字符)
    created_at TEXT NOT NULL,           -- 注册时间 ISO
    created_device TEXT DEFAULT '',     -- 注册设备标识
    settings TEXT DEFAULT '{}',         -- 用户设置 JSON
    progress TEXT DEFAULT '{}',         -- 答题进度 JSON
    last_sync_at TEXT DEFAULT '',       -- 最后同步时间
    is_admin INTEGER DEFAULT 0,         -- 是否管理员
    banned INTEGER DEFAULT 0            -- 是否封禁
);

-- 设备表（一个用户可绑定多设备）
CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,         -- 设备 UUID
    user_id TEXT NOT NULL,              -- 关联同步码
    device_name TEXT DEFAULT '',        -- 设备名称（可选）
    bound_at TEXT NOT NULL,             -- 绑定时间
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 答题统计表（每个用户每个题库一条记录）
CREATE TABLE IF NOT EXISTS stats (
    user_id TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    bank_name TEXT DEFAULT '',
    answered INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,         -- 累计学习时长（秒）
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, bank_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices (user_id);
CREATE INDEX IF NOT EXISTS idx_stats_answered ON stats (answered DESC);
CREATE INDEX IF NOT EXISTS idx_stats_duration ON stats (duration DESC);

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 题库表（管理后台可编辑）
CREATE TABLE IF NOT EXISTS banks (
    id TEXT PRIMARY KEY,                -- 题库ID（如 c-language）
    name TEXT NOT NULL,                 -- 题库名称
    description TEXT DEFAULT '',        -- 题库描述
    category TEXT DEFAULT '',           -- 分类标签
    version INTEGER DEFAULT 1,          -- 版本号
    question_count INTEGER DEFAULT 0,   -- 题目数量
    questions_json TEXT NOT NULL,       -- 题目JSON数组
    allowed_modes TEXT DEFAULT '',       -- 允许的做题模式JSON数组，空表示全部允许
    enabled INTEGER DEFAULT 1,          -- 是否启用（1=启用，0=禁用）
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 题库修改历史
CREATE TABLE IF NOT EXISTS bank_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_id TEXT NOT NULL,
    action TEXT NOT NULL,               -- create/update/add_question/edit_question/delete_question/upload
    detail TEXT DEFAULT '',             -- 操作描述
    operator TEXT DEFAULT '',           -- 操作人
    snapshot TEXT DEFAULT '',           -- 快照（可选）
    created_at TEXT NOT NULL,
    FOREIGN KEY (bank_id) REFERENCES banks(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_history ON bank_history (bank_id, created_at DESC);

-- 应用级配置（如 AI 解读全局配置）
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT DEFAULT ''
);

-- 管理员操作日志
CREATE TABLE IF NOT EXISTS admin_operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_type TEXT DEFAULT '',
    target_id TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    ok INTEGER DEFAULT 1,
    operator TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_operation_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_operation_logs (action);
