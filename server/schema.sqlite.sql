-- 城科卷王 SQLite Schema (与 MySQL 列名一致)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    initials TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_device TEXT,
    settings TEXT,
    progress TEXT,
    bookmarks TEXT,
    last_sync_at TEXT,
    is_admin INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_name TEXT,
    bound_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
    user_id TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    bank_name TEXT,
    answered INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, bank_id)
);

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS banks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    version INTEGER DEFAULT 1,
    question_count INTEGER DEFAULT 0,
    questions_json TEXT,
    allowed_modes TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS bank_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_id TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    operator TEXT,
    snapshot TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS admin_operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    detail TEXT,
    ok INTEGER DEFAULT 1,
    operator TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    level TEXT DEFAULT 'log',
    type TEXT DEFAULT 'console',
    message TEXT,
    stack TEXT,
    page_url TEXT,
    source TEXT,
    line INTEGER DEFAULT 0,
    col INTEGER DEFAULT 0,
    ua TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_banned ON users(banned);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_user ON stats(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_bank ON stats(bank_id);
CREATE INDEX IF NOT EXISTS idx_stats_updated ON stats(updated_at);
CREATE INDEX IF NOT EXISTS idx_banks_enabled ON banks(enabled);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_operation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_client_logs_device ON client_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_created ON client_logs(created_at);
