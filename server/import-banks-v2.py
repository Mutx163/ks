#!/usr/bin/env python3
"""从 MySQL dump 导入 banks 数据到 SQLite（修复转义）"""
import re
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'ks.db')
SQL_PATH = os.path.join(os.path.dirname(__file__), 'data', 'banks.sql')

def unescape_mysql(s):
    """反转义 MySQL 字符串值（去掉外层引号后的值）"""
    if s.startswith("'") and s.endswith("'"):
        s = s[1:-1]
    # MySQL 反斜杠转义
    s = s.replace("\\'", "'")
    s = s.replace('\\"', '"')
    s = s.replace('\\\\', '\\')
    # 注意：\n, \r, \t 保留为原始转义形式（用于 JSON）
    # 不要转为字面控制字符，因为 JSON 不允许
    return s

def parse_row(row_str):
    """解析单行数据 (...) -> dict"""
    inner = row_str[1:-1]
    
    # 按逗号分割，但要处理字符串内的逗号
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
            current.append(c)
            continue
        
        if c == "'" and in_string:
            # 检查是否是转义的引号 ''
            current.append(c)
            in_string = False
            continue
        
        if c == ',' and not in_string:
            values.append(''.join(current).strip())
            current = []
            continue
        
        current.append(c)
    
    values.append(''.join(current).strip())
    
    columns = ['id', 'name', 'description', 'category', 'version', 'question_count', 
               'questions_json', 'allowed_modes', 'enabled', 'created_at', 'updated_at']
    
    result = {}
    for i, col in enumerate(columns):
        if i < len(values):
            val = values[i]
            if val == 'NULL':
                result[col] = None
            elif val.startswith("'") and val.endswith("'"):
                # 反转义 MySQL 字符串
                result[col] = unescape_mysql(val)
            else:
                try:
                    result[col] = int(val)
                except:
                    result[col] = val
    
    return result

def main():
    print("=== 从 MySQL dump 导入 banks 数据（修复版）===\n")
    
    with open(SQL_PATH, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # 找到 VALUES 后面的数据
    values_match = re.search(r'VALUES\s*(.+)', sql_content, re.DOTALL)
    if not values_match:
        print("未找到 VALUES")
        return
    
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
            
            # 验证 JSON
            qj = data.get('questions_json')
            if qj:
                import json
                try:
                    json.loads(qj)
                except json.JSONDecodeError as e:
                    print(f"  WARNING: {data['id']} JSON 解析失败: {e}")
            
            imported += 1
            print(f"  导入: {data['id']} ({data.get('question_count', 0)} 题)")
        except Exception as e:
            print(f"  失败: {data['id']} - {e}")
    
    conn.commit()
    conn.close()
    
    print(f"\n=== 完成! 导入 {imported} 个题库 ===")

if __name__ == '__main__':
    main()
