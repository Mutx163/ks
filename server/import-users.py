#!/usr/bin/env python3
"""从 MySQL dump 导入 users 和 devices 到 SQLite"""
import re
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'ks.db')
SQL_PATH = os.path.join(os.path.dirname(__file__), 'data', 'users-devices.sql')

def unescape_mysql(s):
    if s.startswith("'") and s.endswith("'"):
        s = s[1:-1]
    s = s.replace("\\'", "'")
    s = s.replace('\\"', '"')
    s = s.replace('\\\\', '\\')
    return s

def parse_insert_values(sql_content, table_name):
    pattern = rf'INSERT INTO `{table_name}`.*?VALUES\s*(.*?);'
    match = re.search(pattern, sql_content, re.DOTALL)
    if not match:
        return []
    
    values_str = match.group(1)
    rows = []
    current = []
    in_string = False
    escape_next = False
    paren_depth = 0
    
    for c in values_str:
        if escape_next:
            current.append(c)
            escape_next = False
            continue
        if c == '\\':
            escape_next = True
            current.append(c)
            continue
        if c == "'" and not in_string:
            in_string = True
            current.append(c)
            continue
        if c == "'" and in_string:
            in_string = False
            current.append(c)
            continue
        if c == '(' and not in_string:
            paren_depth += 1
            if paren_depth == 1:
                current = ['(']
                continue
        if c == ')' and not in_string:
            paren_depth -= 1
            if paren_depth == 0:
                current.append(')')
                rows.append(''.join(current))
                continue
        current.append(c)
    
    return rows

def parse_row(row_str, columns):
    inner = row_str[1:-1]
    values = []
    current = []
    in_string = False
    escape_next = False
    
    for c in inner:
        if escape_next:
            current.append(c)
            escape_next = False
            continue
        if c == '\\':
            escape_next = True
            current.append(c)
            continue
        if c == "'" and not in_string:
            in_string = True
            continue
        if c == "'" and in_string:
            in_string = False
            continue
        if c == ',' and not in_string:
            values.append(''.join(current).strip())
            current = []
            continue
        current.append(c)
    values.append(''.join(current).strip())
    
    result = {}
    for i, col in enumerate(columns):
        if i < len(values):
            val = values[i]
            if val == 'NULL':
                result[col] = None
            elif val.startswith("'") and val.endswith("'"):
                result[col] = unescape_mysql(val)
            else:
                try:
                    result[col] = int(val)
                except:
                    result[col] = val
    return result

def main():
    print("=== 导入 users 和 devices ===\n")
    
    with open(SQL_PATH, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    conn = sqlite3.connect(DB_PATH)
    
    # 导入 users
    user_columns = ['id', 'initials', 'created_at', 'is_admin', 'banned']
    user_rows = parse_insert_values(sql_content, 'users')
    print(f"解析到 {len(user_rows)} 个用户")
    
    imported = 0
    for row_str in user_rows:
        data = parse_row(row_str, user_columns)
        if not data.get('id'):
            continue
        try:
            conn.execute("""
                INSERT OR REPLACE INTO users (id, initials, created_at, is_admin, banned)
                VALUES (?, ?, ?, ?, ?)
            """, (data['id'], data.get('initials', ''), data.get('created_at'), 
                  data.get('is_admin', 0), data.get('banned', 0)))
            imported += 1
        except Exception as e:
            print(f"  用户失败: {data['id']} - {e}")
    
    conn.commit()
    print(f"  导入用户: {imported} 个\n")
    
    # 导入 devices
    device_columns = ['device_id', 'user_id', 'device_name', 'bound_at']
    device_rows = parse_insert_values(sql_content, 'devices')
    print(f"解析到 {len(device_rows)} 个设备")
    
    imported = 0
    for row_str in device_rows:
        data = parse_row(row_str, device_columns)
        if not data.get('device_id'):
            continue
        try:
            conn.execute("""
                INSERT OR REPLACE INTO devices (device_id, user_id, device_name, bound_at)
                VALUES (?, ?, ?, ?)
            """, (data['device_id'], data.get('user_id'), 
                  data.get('device_name', ''), data.get('bound_at', data.get('created_at'))))
            imported += 1
        except Exception as e:
            print(f"  设备失败: {data['device_id']} - {e}")
    
    conn.commit()
    print(f"  导入设备: {imported} 个\n")
    
    # 导入 stats
    stat_columns = ['user_id', 'bank_id', 'bank_name', 'answered', 'correct', 'duration', 'updated_at']
    stat_rows = parse_insert_values(sql_content, 'stats')
    if stat_rows:
        print(f"解析到 {len(stat_rows)} 条统计")
        imported = 0
        for row_str in stat_rows:
            data = parse_row(row_str, stat_columns)
            if not data.get('user_id'):
                continue
            try:
                conn.execute("""
                    INSERT OR REPLACE INTO stats (user_id, bank_id, bank_name, answered, correct, duration, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (data['user_id'], data.get('bank_id'), data.get('bank_name', ''),
                      data.get('answered', 0), data.get('correct', 0), 
                      data.get('duration', 0), data.get('updated_at')))
                imported += 1
            except Exception as e:
                print(f"  统计失败: {data['user_id']}/{data.get('bank_id')} - {e}")
        conn.commit()
        print(f"  导入统计: {imported} 条\n")
    
    conn.close()
    print("=== 完成 ===")

if __name__ == '__main__':
    main()
