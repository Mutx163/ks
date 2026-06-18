#!/usr/bin/env python3
"""修复 index.js 中的 MySQL 特有语法为 SQLite 兼容"""
import re

INPUT = 'D:/Users/34045/Desktop/cursor/html/ks/server/index.js'
OUTPUT = 'D:/Users/34045/Desktop/cursor/html/ks/server/index-sqlite-v2.js'

with open(INPUT, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 替换 CONVERT_TZ
content = content.replace("DATE(CONVERT_TZ(s.updated_at, '+00:00', '+08:00'))", "DATE(s.updated_at)")
content = content.replace("DATE(CONVERT_TZ(created_at, '+00:00', '+08:00'))", "DATE(created_at)")
content = content.replace("DATE(CONVERT_TZ(updated_at, '+00:00', '+08:00'))", "DATE(updated_at)")

# 2. 替换 ON DUPLICATE KEY UPDATE 为 INSERT OR REPLACE
# devices 表
content = content.replace(
    "'INSERT INTO devices (device_id, user_id, bound_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), bound_at = VALUES(bound_at)'",
    "'INSERT OR REPLACE INTO devices (device_id, user_id, bound_at) VALUES (?, ?, ?)'"
)

# stats 表 - 需要找到多行语句
content = re.sub(
    r"INSERT INTO stats \(user_id, bank_id, bank_name, answered, correct, duration, updated_at\)\s*\n\s*VALUES \(\?, \?, \?, \?, \?, \?, \?\)\s*\n\s*ON DUPLICATE KEY UPDATE\s*\n\s*bank_name = VALUES\(bank_name\),\s*\n\s*answered = VALUES\(answered\),\s*\n\s*correct = VALUES\(correct\),\s*\n\s*duration = VALUES\(duration\),\s*\n\s*updated_at = VALUES\(updated_at\)",
    "INSERT OR REPLACE INTO stats (user_id, bank_id, bank_name, answered, correct, duration, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    content
)

# app_config 表
content = content.replace(
    "\"INSERT INTO app_config (`key`, `value`, `updated_at`) VALUES ('ai_config', ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = VALUES(`updated_at`)\"",
    "\"INSERT OR REPLACE INTO app_config (`key`, `value`, `updated_at`) VALUES ('ai_config', ?, ?)\""
)

# users 表 - 多行语句
content = re.sub(
    r"INSERT INTO users \(id, initials, created_at, settings, progress, bookmarks\)\s*\n\s*VALUES \(\?, \?, \?, \?, \?, \?\)\s*\n\s*ON DUPLICATE KEY UPDATE\s*\n\s*initials = VALUES\(initials\),\s*\n\s*settings = VALUES\(settings\),\s*\n\s*progress = VALUES\(progress\),\s*\n\s*bookmarks = VALUES\(bookmarks\)",
    "INSERT OR REPLACE INTO users (id, initials, created_at, settings, progress, bookmarks) VALUES (?, ?, ?, ?, ?, ?)",
    content
)

# 其他可能的 ON DUPLICATE KEY UPDATE 模式
# 通用处理：把剩余的 ON DUPLICATE KEY UPDATE 替换掉
lines = content.split('\n')
new_lines = []
skip_next = False

for i, line in enumerate(lines):
    if skip_next:
        skip_next = False
        continue
    
    if 'ON DUPLICATE KEY UPDATE' in line:
        # 检查前一行是否有 VALUES
        if i > 0 and 'VALUES' in new_lines[-1]:
            # 把 VALUES 行末尾的逗号去掉，加上分号
            prev = new_lines[-1]
            if prev.rstrip().endswith(','):
                new_lines[-1] = prev.rstrip()[:-1] + ';'
        continue
    
    new_lines.append(line)

content = '\n'.join(new_lines)

with open(OUTPUT, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'已生成: {OUTPUT}')

# 验证
remaining = content.count('ON DUPLICATE KEY UPDATE')
remaining_tz = content.count('CONVERT_TZ')
print(f'剩余 ON DUPLICATE KEY UPDATE: {remaining}')
print(f'剩余 CONVERT_TZ: {remaining_tz}')
