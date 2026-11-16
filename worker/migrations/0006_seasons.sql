-- 0006 赛季表（建表 / 唯一 active 索引 / 种子赛季）
--
-- 全部语句天然幂等：可重复执行，不会报错也不会重复插数据。
-- 本文件不碰 stats，重建 stats 在 0007（那一步需要运行器先查 pragma 再执行）。
--
-- 设计要点：
--   * 赛季 id 手工指定（正则 `[a-z0-9][a-z0-9-]{1,31}`），不用自增，方便跨环境对齐；
--   * `is_active` 用「部分唯一索引」约束只能有一个当前赛季（CHECK 无法表达全表至多一行）；
--   * 现有累计数据全部归入 `legacy`（历史赛季），只读；
--   * 预置「2026 秋季学期」并设为 active，避免上线到管理员建赛季之间出现空窗。

CREATE TABLE IF NOT EXISTS seasons (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    start_date TEXT,
    end_date   TEXT,
    is_active  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 全表至多一行 is_active = 1
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_active
    ON seasons (is_active) WHERE is_active = 1;

-- 历史赛季：现有 stats 全部归属这里（只读）
INSERT OR IGNORE INTO seasons (id, name, start_date, end_date, is_active, created_at)
VALUES ('legacy', '历史数据（赛季制度上线前）', NULL, NULL, 0, datetime('now'));

-- 初始当前赛季：只在没有任何 active 赛季时插入（纯 SQL 条件插入，幂等）
INSERT INTO seasons (id, name, start_date, end_date, is_active, created_at)
SELECT '2026-fall', '2026 秋季学期', NULL, NULL, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE is_active = 1);
