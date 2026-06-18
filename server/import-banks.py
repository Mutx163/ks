#!/usr/bin/env python3
"""从 MySQL dump 导入 banks 数据到 SQLite"""
import re
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'ks.db')
SQL_PATH = os.path.join(os.path.dirname(__file__), 'data', 'banks.sql')

def parse_values(sql_content):
    """解析 INSERT INTO ... VALUES (...) 语句"""
    # 找到 VALUES 后面的所有 (...) 块
    values_match = re.search(r'VALUES\s*(.+)', sql_content, re.DOTALL)
    if not values_match:
        return []
    
    values_str = values_match.group(1)
    
    # 解析每一行
    rows = []
    current = []
    in_string = False
    escape_next = False
    paren_depth = 0
    
    i = 0
    while i < len(values_str):
        c = values_str[i]
        
        if escape_next:
            current.append(c)
            escape_next = False
            i += 1
            continue
        
        if c == '\\':
            escape_next = True
            current.append(c)
            i += 1
            continue
        
        if c == "'" and not in_string:
            in_string = True
            current.append(c)
            i += 1
            continue
        
        if c == "'" and in_string:
            in_string = False
            current.append(c)
            i += 1
            continue
        
        if c == '(' and not in_string:
            paren_depth += 1
            if paren_depth == 1:
                current = ['(']
                i += 1
                continue
        
        if c == ')' and not in_string:
            paren_depth -= 1
            if paren_depth == 0:
                current.append(')')
                rows.append(''.join(current))
                i += 1
                continue
        
        current.append(c)
        i += 1
    
    return rows

def parse_row(row_str):
    """解析单行数据 (...) -> dict"""
    # 去掉外层括号
    inner = row_str[1:-1]
    
    # 解析字段值
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
    
    # 字段名
    columns = ['id', 'name', 'description', 'category', 'version', 'question_count', 
               'questions_json', 'allowed_modes', 'enabled', 'created_at', 'updated_at']
    
    result = {}
    for i, col in enumerate(columns):
        if i < len(values):
            val = values[i]
            if val == 'NULL':
                result[col] = None
            elif val.startswith("'") and val.endswith("'"):
                result[col] = val[1:-1]
            else:
                try:
                    result[col] = int(val)
                except:
                    result[col] = val
    
    return result

def main():
    print("=== 从 MySQL dump 导入 banks 数据 ===\n")
    
    with open(SQL_PATH, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    rows = parse_values(sql_content)
    print(f"解析到 {len(rows)} 行数据\n")
    
    conn = sqlite3.connect(DB_PATH)
    
    imported = 0
    for row_str in rows:
        data = parse_row(row_str)
        if not data.get('id'):
            continue
        
        try:
            conn.execute("""
                INSERT OR REPLACE INTO banks 
                (id, name, description, category, version, question_count, questions_json, allowed_modes, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('id'),
                data.get('name'),
                data.get('description'),
                data.get('category'),
                data.get('version', 1),
                data.get('question_count', 0),
                data.get('questions_json'),
                data.get('allowed_modes'),
                data.get('enabled', 1),
                data.get('created_at'),
                data.get('updated_at')
            ))
            imported += 1
            print(f"  导入: {data['id']} ({data.get('question_count', 0)} 题)")
        except Exception as e:
            print(f"  失败: {data['id']} - {e}")
    
    conn.commit()
    conn.close()
    
    print(f"\n=== 完成! 导入 {imported} 个题库 ===")

if __name__ == '__main__':
    main()
