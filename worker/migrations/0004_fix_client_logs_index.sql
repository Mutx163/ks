-- 修复：D1/SQLite 不支持 MySQL 风格的前缀索引 message(50)，
-- 原 schema.sql 会在最后一步报 "no such function: message" 导致新库初始化失败。
DROP INDEX IF EXISTS idx_client_logs_error_summary;
CREATE INDEX IF NOT EXISTS idx_client_logs_error_summary
    ON client_logs (level, substr(message, 1, 50));
