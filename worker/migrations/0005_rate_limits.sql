-- 持久化限流计数（R2 安全批）
-- 背景：内存计数在 Cloudflare 上被 isolate 分摊，线上连打 20 次错误同步码一个 429 都没触发。
-- 说明：
--   * 只新建一张表，不动 users / stats / banks 等任何现有表结构；
--   * 全部语句可重放（IF NOT EXISTS），重复执行安全；
--   * Worker 侧也会在首次使用时限流表不存在就自建（CREATE TABLE IF NOT EXISTS），
--     所以本迁移不是「必须先跑」，而是把这个动作显式化、可控化。
CREATE TABLE IF NOT EXISTS rate_limits (
    bucket TEXT PRIMARY KEY,          -- 桶名，如 bind:ip:1.2.3.4 / admin:global / ai:dev:<deviceId>
    count INTEGER NOT NULL DEFAULT 0, -- 当前窗口内计数
    reset_at INTEGER NOT NULL         -- 窗口结束时间（epoch 毫秒）
);

-- 过期行清理用（可选，方便后续加定期清理任务；当前未强制依赖）
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits (reset_at);
