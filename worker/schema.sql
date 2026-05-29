-- 用户表（同步码为核心标识）
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                -- 同步码（6位，如 KW3A7F）
    initials TEXT NOT NULL,             -- 姓名首字母 (1-4字符)
    created_at TEXT NOT NULL,           -- 注册时间 ISO
    created_device TEXT DEFAULT '',     -- 注册设备标识
    settings TEXT DEFAULT '{}',         -- 用户设置 JSON
    progress TEXT DEFAULT '{}',         -- 答题进度 JSON
    last_sync_at TEXT DEFAULT '',       -- 最后同步时间
    is_admin INTEGER DEFAULT 0          -- 是否管理员
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
