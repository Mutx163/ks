#!/usr/bin/env python3
"""
从宝塔服务器 MySQL 导出数据，生成 SQLite 数据库
用法: python mysql-to-sqlite.py
"""
import json
import os
import sqlite3
import paramiko

# 服务器信息
SERVER = "8.135.36.100"
USER = "root"
PASSWORD = "19989123549Abc"
DB_NAME = "ks"
MYSQL_USER = "ks_user"
MYSQL_PASS = "Ks@2024!Secure"

# 表顺序（跳过 client_logs，太大）
TABLES = [
    'users', 'devices', 'stats', 'announcements', 'banks',
    'bank_history', 'app_config', 'admin_operation_logs'
]

# 实际 MySQL 列名（从 SHOW COLUMNS 获取）
COLUMNS = {
    'users': ['id', 'initials', 'created_at', 'created_device', 'settings', 'progress', 'bookmarks', 'last_sync_at', 'is_admin', 'banned'],
    'devices': ['device_id', 'user_id', 'device_name', 'bound_at'],
    'stats': ['user_id', 'bank_id', 'bank_name', 'answered', 'correct', 'duration', 'updated_at'],
    'announcements': ['id', 'content', 'created_at'],
    'banks': ['id', 'name', 'description', 'category', 'version', 'question_count', 'questions_json', 'allowed_modes', 'enabled', 'created_at', 'updated_at'],
    'bank_history': ['id', 'bank_id', 'action', 'detail', 'operator', 'snapshot', 'created_at'],
    'app_config': ['key', 'value', 'updated_at', 'updated_by'],
    'admin_operation_logs': ['id', 'action', 'target_type', 'target_id', 'detail', 'ok', 'operator', 'created_at'],
    'client_logs': ['id', 'device_id', 'level', 'type', 'message', 'stack', 'page_url', 'source', 'line', 'col', 'ua', 'created_at']
}

def get_ssh():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, username=USER, password=PASSWORD)
    return ssh

def run_cmd(ssh, cmd, timeout=60):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    return stdout.read().decode().strip(), stderr.read().decode().strip()

def export_table(ssh, table):
    """从 MySQL 导出表数据"""
    print(f"导出 {table}...")
    
    cols = COLUMNS.get(table, [])
    if not cols:
        return []
    
    # 构建 JSON_OBJECT 参数
    obj_parts = []
    for c in cols:
        obj_parts.append(f"'{c}'")
        obj_parts.append(f"`{c}`")
    obj_str = ','.join(obj_parts)
    
    sql = f"SELECT JSON_ARRAYAGG(JSON_OBJECT({obj_str})) FROM `{table}`"
    
    # 通过 SSH 执行 MySQL 命令
    mysql_cmd = f"mysql -u {MYSQL_USER} -p'{MYSQL_PASS}' {DB_NAME} -N -e \"{sql}\""
    
    out, err = run_cmd(ssh, mysql_cmd, timeout=120)
    
    # 忽略 Warning
    if 'Warning' in err:
        err = ''
    if err:
        print(f"  MySQL 错误: {err}")
    
    if not out or out == 'NULL':
        return []
    
    try:
        data = json.loads(out)
        return data if data else []
    except json.JSONDecodeError as e:
        print(f"  JSON 解析失败: {e}")
        return []

def import_to_sqlite(data_dict, db_path):
    """导入数据到 SQLite"""
    if os.path.exists(db_path):
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    
    # 创建简化的 schema（适配实际列名）
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            initials TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_device TEXT,
            settings TEXT,
            progress TEXT,
            bookmarks TEXT,
            last_sync_at TEXT,
            is_admin INTEGER DEFAULT 0,
            banned INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS devices (
            device_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_name TEXT,
            bound_at TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS stats (
            user_id TEXT NOT NULL,
            bank_id TEXT NOT NULL,
            bank_name TEXT,
            answered INTEGER DEFAULT 0,
            correct INTEGER DEFAULT 0,
            duration INTEGER DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, bank_id)
        );
        
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS banks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            version INTEGER DEFAULT 1,
            question_count INTEGER DEFAULT 0,
            questions_json TEXT,
            allowed_modes TEXT,
            enabled INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        );
        
        CREATE TABLE IF NOT EXISTS bank_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_id TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT,
            operator TEXT,
            snapshot TEXT,
            created_at TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            updated_by TEXT
        );
        
        CREATE TABLE IF NOT EXISTS admin_operation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            detail TEXT,
            ok INTEGER DEFAULT 1,
            operator TEXT,
            created_at TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS client_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            level TEXT DEFAULT 'log',
            type TEXT DEFAULT 'console',
            message TEXT,
            stack TEXT,
            page_url TEXT,
            source TEXT,
            line INTEGER DEFAULT 0,
            col INTEGER DEFAULT 0,
            ua TEXT,
            created_at TEXT NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
        CREATE INDEX IF NOT EXISTS idx_stats_user ON stats(user_id);
        CREATE INDEX IF NOT EXISTS idx_stats_bank ON stats(bank_id);
        CREATE INDEX IF NOT EXISTS idx_banks_enabled ON banks(enabled);
        CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_operation_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_client_logs_device ON client_logs(device_id);
        CREATE INDEX IF NOT EXISTS idx_client_logs_created ON client_logs(created_at);
    ''')
    
    total = 0
    for table in TABLES:
        rows = data_dict.get(table, [])
        if not rows:
            print(f"  {table}: 0 行")
            continue
        
        cols = COLUMNS.get(table, [])
        placeholders = ','.join(['?' for _ in cols])
        col_names = ','.join([f'`{c}`' for c in cols])
        
        sql = f"INSERT OR REPLACE INTO `{table}` ({col_names}) VALUES ({placeholders})"
        
        imported = 0
        for row in rows:
            try:
                values = [row.get(c) for c in cols]
                conn.execute(sql, values)
                imported += 1
            except Exception as e:
                print(f"  {table} 行导入失败: {e}")
        
        conn.commit()
        print(f"  {table}: {imported}/{len(rows)} 行")
        total += imported
    
    conn.close()
    return total

def main():
    print("=== MySQL -> SQLite 数据迁移 ===\n")
    
    ssh = get_ssh()
    print("SSH 连接成功\n")
    
    # 导出所有表
    data_dict = {}
    for table in TABLES:
        data_dict[table] = export_table(ssh, table)
    
    ssh.close()
    
    # 统计
    total_rows = sum(len(rows) for rows in data_dict.values())
    print(f"\n共导出 {total_rows} 行数据")
    
    # 导入到 SQLite
    db_path = os.path.join(os.path.dirname(__file__), 'data', 'ks.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    print(f"\n导入到 SQLite: {db_path}")
    imported = import_to_sqlite(data_dict, db_path)
    
    print(f"\n=== 完成! 共导入 {imported} 行 ===")
    print(f"数据库文件: {db_path}")
    print(f"文件大小: {os.path.getsize(db_path) / 1024:.1f} KB")

if __name__ == '__main__':
    main()
