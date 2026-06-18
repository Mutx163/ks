#!/usr/bin/env python3
"""将 TSV 数据导入 SQLite"""
import os
import sqlite3

EXPORT_DIR = os.path.join(os.path.dirname(__file__), 'data', 'export')
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'ks.db')

# 表列名（与 MySQL 一致）
COLUMNS = {
    'users': ['id', 'initials', 'created_at', 'created_device', 'settings', 'progress', 'bookmarks', 'last_sync_at', 'is_admin', 'banned'],
    'devices': ['device_id', 'user_id', 'device_name', 'bound_at'],
    'stats': ['user_id', 'bank_id', 'bank_name', 'answered', 'correct', 'duration', 'updated_at'],
    'announcements': ['id', 'content', 'created_at'],
    'banks': ['id', 'name', 'description', 'category', 'version', 'question_count', 'questions_json', 'allowed_modes', 'enabled', 'created_at', 'updated_at'],
    'bank_history': ['id', 'bank_id', 'action', 'detail', 'operator', 'snapshot', 'created_at'],
    'app_config': ['key', 'value', 'updated_at', 'updated_by'],
    'admin_operation_logs': ['id', 'action', 'target_type', 'target_id', 'detail', 'ok', 'operator', 'created_at'],
}

# 整数列
INT_COLUMNS = {
    'users': ['is_admin', 'banned'],
    'stats': ['answered', 'correct', 'duration'],
    'banks': ['version', 'question_count', 'enabled'],
    'bank_history': ['id'],
    'announcements': ['id'],
    'admin_operation_logs': ['id', 'ok'],
}

def parse_tsv(filepath):
    """解析 TSV 文件"""
    rows = []
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if not lines:
        return []
    
    # 第一行是表头（列名），跳过
    for line in lines[1:]:
        line = line.rstrip('\n').rstrip('\r')
        if not line:
            continue
        # 简单按 tab 分割
        parts = line.split('\t')
        rows.append(parts)
    
    return rows

def import_table(conn, table, rows):
    """导入表数据"""
    cols = COLUMNS.get(table, [])
    if not cols:
        return 0
    
    int_cols = INT_COLUMNS.get(table, [])
    placeholders = ','.join(['?' for _ in cols])
    col_names = ','.join([f'`{c}`' for c in cols])
    sql = f"INSERT OR REPLACE INTO `{table}` ({col_names}) VALUES ({placeholders})"
    
    imported = 0
    for parts in rows:
        if len(parts) < len(cols):
            # 补齐列数
            parts.extend([None] * (len(cols) - len(parts)))
        
        values = []
        for i, c in enumerate(cols):
            val = parts[i] if i < len(parts) else None
            # 空字符串转 None
            if val == '' or val == 'NULL' or val is None:
                val = None
            # 整数列转换
            elif c in int_cols:
                try:
                    val = int(val)
                except (ValueError, TypeError):
                    val = 0
            values.append(val)
        
        try:
            conn.execute(sql, values)
            imported += 1
        except Exception as e:
            print(f"  行导入失败: {e}")
    
    conn.commit()
    return imported

def main():
    print("=== TSV -> SQLite 导入 ===\n")
    
    # 删除旧数据库
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    conn = sqlite3.connect(DB_PATH)
    
    # 创建 schema
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sqlite.sql')
    with open(schema_path, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())
    print("Schema 创建完成\n")
    
    total = 0
    for table in COLUMNS.keys():
        filepath = os.path.join(EXPORT_DIR, f'{table}.tsv')
        if not os.path.exists(filepath):
            print(f"  {table}: 文件不存在")
            continue
        
        rows = parse_tsv(filepath)
        if not rows:
            print(f"  {table}: 0 行")
            continue
        
        imported = import_table(conn, table, rows)
        print(f"  {table}: {imported}/{len(rows)} 行")
        total += imported
    
    conn.close()
    
    print(f"\n=== 完成! 共导入 {total} 行 ===")
    print(f"数据库: {DB_PATH}")
    print(f"大小: {os.path.getsize(DB_PATH) / 1024:.1f} KB")

if __name__ == '__main__':
    main()
