#!/usr/bin/env python3
"""从 D1 导出数据并导入 MySQL"""
import subprocess
import json
import paramiko
import re

WORKER_DIR = "D:/Users/34045/Desktop/cursor/html/ks/worker"
TABLES = ['users', 'devices', 'stats', 'banks', 'announcements', 'bank_history', 'app_config', 'admin_operation_logs']
DB_PWD = "Ks@2024!Secure"

def export_d1(table):
    """从 D1 导出表数据"""
    cmd = f'npx wrangler d1 execute ks-leaderboard --remote --command "SELECT * FROM {table}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=WORKER_DIR, timeout=120)
    
    # wrangler 输出在 stdout
    output = result.stdout
    
    # 找到 JSON 数组部分（以 [ 开头，包含 "results"）
    # 从后往前找，因为 wrangler 会输出进度信息
    lines = output.split('\n')
    json_lines = []
    in_json = False
    bracket_count = 0
    
    for line in lines:
        stripped = line.strip()
        if stripped == '[' and not in_json:
            in_json = True
            json_lines = [stripped]
            bracket_count = 1
        elif in_json:
            json_lines.append(stripped)
            bracket_count += stripped.count('[') - stripped.count(']')
            if bracket_count <= 0:
                break
    
    if json_lines:
        try:
            json_str = '\n'.join(json_lines)
            data = json.loads(json_str)
            if isinstance(data, list) and len(data) > 0 and 'results' in data[0]:
                return data[0]['results']
        except Exception as e:
            print(f"  JSON 解析错误: {e}")
    
    return None

def escape_mysql(val):
    """转义 MySQL 值"""
    if val is None:
        return 'NULL'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bool):
        return '1' if val else '0'
    if isinstance(val, (dict, list)):
        val = json.dumps(val, ensure_ascii=False)
    val = str(val).replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
    return f"'{val}'"

def generate_insert(table, rows):
    """生成 INSERT 语句"""
    if not rows:
        return ""
    
    columns = list(rows[0].keys())
    col_str = ', '.join([f'`{c}`' for c in columns])
    
    sql = f"-- {table}: {len(rows)} rows\n"
    
    for row in rows:
        values = [escape_mysql(row.get(c)) for c in columns]
        val_str = ', '.join(values)
        
        # 处理主键冲突
        if table == 'stats':
            update_cols = [c for c in columns if c not in ['user_id', 'bank_id']]
        else:
            pk = columns[0]
            update_cols = [c for c in columns if c != pk]
        
        updates = ', '.join([f'`{c}` = VALUES(`{c}`)' for c in update_cols])
        sql += f"INSERT INTO `{table}` ({col_str}) VALUES ({val_str}) ON DUPLICATE KEY UPDATE {updates};\n"
    
    return sql

def main():
    print("=== 导出 D1 数据 ===\n")
    
    all_sql = """SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

"""
    
    for table in TABLES:
        print(f"导出 {table}...", end=" ", flush=True)
        rows = export_d1(table)
        if rows:
            print(f"{len(rows)} 行")
            sql = generate_insert(table, rows)
            all_sql += f"\n-- ==================== {table} ====================\n"
            all_sql += sql
        else:
            print("无数据或导出失败")
    
    all_sql += "\nSET FOREIGN_KEY_CHECKS = 1;\n"
    
    # 保存 SQL 文件
    sql_file = "D:/Users/34045/Desktop/cursor/html/ks/server/d1-data.sql"
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(all_sql)
    print(f"\nSQL 文件已保存: {sql_file}")
    print(f"SQL 文件大小: {os.path.getsize(sql_file)} bytes")
    
    # 上传并导入到 MySQL
    print("\n=== 上传并导入到 MySQL ===")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('8.135.36.100', username='root', password='19989123549Abc')
    
    sftp = ssh.open_sftp()
    remote_path = '/www/wwwroot/a.mutx.ccwu.cc/server/d1-data.sql'
    print(f"上传到 {remote_path}...")
    sftp.put(sql_file, remote_path)
    sftp.close()
    print("上传完成")
    
    # 导入
    print("导入数据...")
    cmd = f"mysql -u ks_user -p'{DB_PWD}' ks < {remote_path} 2>&1"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    err = stderr.read().decode().strip()
    out = stdout.read().decode().strip()
    if err:
        print(f"导入结果: {err}")
    else:
        print("导入成功!")
    
    # 验证
    print("\n=== 验证数据 ===")
    for table in TABLES:
        cmd = f"mysql -u ks_user -p'{DB_PWD}' ks -e 'SELECT COUNT(*) as cnt FROM {table};' 2>/dev/null"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode().strip()
        lines = out.split('\n')
        if len(lines) > 1:
            print(f"  {table}: {lines[1]} 行")
    
    ssh.close()
    print("\n[DONE] 数据迁移完成!")

import os

if __name__ == "__main__":
    main()
