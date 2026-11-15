-- 给用户表增加收藏数据列
--
-- 幂等说明（重要）：
--   SQLite **不支持** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`（实测语法错误），
--   纯 SQL 无法在文件内做条件分支。因此本迁移的幂等由运行器保证：
--     scripts/apply-migrations.ps1 在执行本文件前先 `PRAGMA table_info(users)`，
--     若 bookmarks 已存在则跳过并打印 [skip]，不会重复执行 ALTER。
--   正常路径 `wrangler d1 migrations apply` 也不会重放已记录在 d1_migrations 里的迁移，
--   所以线上不存在二次执行的问题；只有手工重跑本文件才会撞 duplicate column。
ALTER TABLE users ADD COLUMN bookmarks TEXT DEFAULT '{}';
