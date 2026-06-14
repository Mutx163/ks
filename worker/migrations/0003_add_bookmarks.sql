-- 给用户表增加收藏数据列
ALTER TABLE users ADD COLUMN bookmarks TEXT DEFAULT '{}';
