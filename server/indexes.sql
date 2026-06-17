-- 性能优化索引
-- 运行: mysql -u ks_user -p'Ks@2024!Secure' ks < server/indexes.sql

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(banned);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 设备表索引
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- 统计表索引（排行榜查询优化）
CREATE INDEX IF NOT EXISTS idx_stats_user_id ON stats(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_bank_id ON stats(bank_id);
CREATE INDEX IF NOT EXISTS idx_stats_updated_at ON stats(updated_at);
CREATE INDEX IF NOT EXISTS idx_stats_user_bank ON stats(user_id, bank_id);

-- 题库表索引
CREATE INDEX IF NOT EXISTS idx_banks_enabled ON banks(enabled);

-- 操作日志索引
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_operation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_operation_logs(action);
