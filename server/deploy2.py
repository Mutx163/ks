#!/usr/bin/env python3
"""自动部署城科卷王 API 到宝塔服务器"""
import paramiko
import time

SERVER = "8.135.36.100"
USER = "root"
PASSWORD = "19989123549Abc"
REMOTE_DIR = "/www/wwwroot/a.mutx.ccwu.cc/server"
DB_PASSWORD = "Ks@2024!Secure"
MYSQL_ROOT_PWD = "admin"
NODE_PATH = "/www/server/nodejs/v26.3.0/bin"

def run_cmd(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    return out.strip(), err.strip()

def main():
    print("=== 连接服务器 ===")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, username=USER, password=PASSWORD)
    print("[OK] 连接成功\n")

    # 1. 创建数据库和用户
    print("=== 1. 创建数据库 ===")
    sql = "CREATE DATABASE IF NOT EXISTS ks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; "
    sql += "CREATE USER IF NOT EXISTS 'ks_user'@'localhost' IDENTIFIED BY '" + DB_PASSWORD + "'; "
    sql += "GRANT ALL PRIVILEGES ON ks.* TO 'ks_user'@'localhost'; FLUSH PRIVILEGES;"
    cmd = "mysql -u root -p'" + MYSQL_ROOT_PWD + "' -e \"" + sql + "\""
    out, err = run_cmd(ssh, cmd)
    if err and "ERROR" in err:
        print("[WARN] " + err)
    else:
        print("[OK] 数据库创建完成\n")

    # 2. 安装 npm 依赖
    print("=== 2. 安装依赖 ===")
    cmd = "export PATH=" + NODE_PATH + ":$PATH && cd " + REMOTE_DIR + " && npm install --production 2>&1"
    out, err = run_cmd(ssh, cmd)
    print(out[-200:] if len(out) > 200 else out)
    print("[OK] 依赖安装完成\n")

    # 3. 导入表结构
    print("=== 3. 导入表结构 ===")
    cmd = "mysql -u ks_user -p'" + DB_PASSWORD + "' ks < " + REMOTE_DIR + "/schema.mysql.sql 2>&1"
    out, err = run_cmd(ssh, cmd)
    if err and "ERROR" in err:
        print("[WARN] " + err)
    else:
        print("[OK] 表结构导入完成\n")

    # 4. 验证表
    print("=== 4. 验证数据库表 ===")
    cmd = "mysql -u ks_user -p'" + DB_PASSWORD + "' ks -e 'SHOW TABLES;'"
    out, err = run_cmd(ssh, cmd)
    print(out)

    # 5. 安装 PM2 并启动服务
    print("\n=== 5. 启动服务 ===")
    cmd = "export PATH=" + NODE_PATH + ":$PATH && which pm2 || npm install -g pm2 2>&1"
    run_cmd(ssh, cmd)
    
    # 停止旧进程
    cmd = "export PATH=" + NODE_PATH + ":$PATH && pm2 delete ks-api 2>/dev/null; true"
    run_cmd(ssh, cmd)

    # 启动新进程
    cmd = "export PATH=" + NODE_PATH + ":$PATH && cd " + REMOTE_DIR + " && pm2 start index.js --name ks-api 2>&1"
    out, err = run_cmd(ssh, cmd)
    print(out[-300:] if len(out) > 300 else out)

    # 保存 PM2 配置
    cmd = "export PATH=" + NODE_PATH + ":$PATH && pm2 save 2>&1"
    run_cmd(ssh, cmd)

    # 6. 检查服务状态
    print("\n=== 6. 服务状态 ===")
    cmd = "export PATH=" + NODE_PATH + ":$PATH && pm2 list"
    out, err = run_cmd(ssh, cmd)
    print(out)

    # 7. 测试 API
    print("\n=== 7. 测试 API ===")
    time.sleep(2)
    cmd = "curl -s http://127.0.0.1:3001/api/health"
    out, err = run_cmd(ssh, cmd)
    print("Health check: " + out)

    ssh.close()
    print("\n[DONE] 服务部署完成！")
    print("下一步：配置 Nginx 反向代理")

if __name__ == "__main__":
    main()
