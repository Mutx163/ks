-- 0007 stats 按赛季分桶（重建表）
--
-- 为什么必须重建而不是加列：
--   现有主键是 (user_id, bank_id)。只加 season_id 而不改主键，同一用户同一题库跨赛季
--   仍然只有一行，新赛季第一笔同步会把旧数字累加上去 —— 赛季等于白做。
--
-- ⚠️ 本文件**不是幂等的**：重放一次就会把 stats 再拆一遍、数据全丢。
--    执行者必须先 `PRAGMA table_info(stats)` 检查 season_id 是否存在：
--    scripts/apply-migrations.ps1 已按文件名 `stats_season` 做了这个守卫（存在则 [skip]）。
--    生产执行前必须先 `wrangler d1 export` 快照（DROP TABLE 是唯一不可逆的一步）。
--
-- 迁移后：现有全部行归入 'legacy'（历史赛季，只读），新赛季从零开始。

CREATE TABLE stats_season_new (
    user_id    TEXT NOT NULL,
    bank_id    TEXT NOT NULL,
    season_id  TEXT NOT NULL,
    bank_name  TEXT DEFAULT '',
    answered   INTEGER DEFAULT 0,
    correct    INTEGER DEFAULT 0,
    duration   INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, bank_id, season_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO stats_season_new (user_id, bank_id, season_id, bank_name, answered, correct, duration, updated_at)
    SELECT user_id, bank_id, 'legacy', bank_name, answered, correct, duration, updated_at
    FROM stats;

DROP TABLE stats;

ALTER TABLE stats_season_new RENAME TO stats;

-- 排行榜：先按赛季过滤再排序
CREATE INDEX IF NOT EXISTS idx_stats_season_answered ON stats (season_id, answered DESC);
-- 后台「今日活跃」：按赛季 + 时间
CREATE INDEX IF NOT EXISTS idx_stats_season_updated  ON stats (season_id, updated_at);

-- 旧索引 review：idx_stats_answered / idx_stats_duration 已被新索引覆盖大部分场景，
-- 本批不删除（避免无关变更），后续清理时再动。
