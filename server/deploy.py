#!/usr/bin/env python3
"""自动部署城科卷王 API 到宝塔服务器"""
import paramiko
import os
import time

SERVER = "8.135.36.100"
USER = "root"
PASSWORD = "19989123549Abc"
REMOTE_DIR = "/www/wwwroot/a.mutx.ccwu.cc/server"
DB_PASSWORD = "Ks@2024!Secure"

def run_cmd(ssh, cmd, sudo=False):
    """执行命令并返回输出"""
    if sudo:
        cmd = f"echo '{PASSWORD}' | sudo -S {cmd}"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    return out, err

def main():
    print("=== 连接服务器 ===")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, username=USER, password=PASSWORD)
    print("✅ 连接成功\n")
    
    # 1. 创建目录
    print("=== 1. 创建目录 ===")
    run_cmd(ssh, f"mkdir -p {REMOTE_DIR}")
    print("✅ 目录创建完成\n")
    
    # 2. 创建数据库
    print("=== 2. 创建数据库 ===")
    mysql_cmd = f"""mysql -u root -e \"
CREATE DATABASE IF NOT EXISTS ks CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ks_user'@'localhost' IDENTIFIED BY '{DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ks.* TO 'ks_user'@'localhost';
FLUSH PRIVILEGES;
\""""
    out, err = run_cmd(ssh, mysql_cmd)
    if err and "ERROR" in err:
        print(f"⚠️ 数据库可能已存在: {err}")
    else:
        print("✅ 数据库创建完成\n")
    
    # 3. 上传文件
    print("=== 3. 上传文件 ===")
    sftp = ssh.open_sftp()
    
    local_dir = os.path.dirname(os.path.abspath(__file__))
    files_to_upload = [
        "index.js",
        "db.js", 
        "schema.mysql.sql",
        "import-data.js",
        "package.json",
        ".env.example"
    ]
    
    for f in files_to_upload:
        local_path = os.path.join(local_dir, f)
        remote_path = f"{REMOTE_DIR}/{f}"
        if os.path.exists(local_path):
            print(f"  上传 {f}...")
            sftp.put(local_path, remote_path)
            print(f"  ✅ {f} 上传完成")
        else:
            print(f"  ⚠️ {f} 不存在，跳过")
    
    # 创建 .env 文件
    print("  创建 .env...")
    env_content = f"""DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ks_user
DB_PASSWORD={DB_PASSWORD}
DB_NAME=ks
PORT=3001
"""
    with sftp.open(f"{REMOTE_DIR}/.env", "w") as f:
        f.write(env_content)
    print("  ✅ .env 创建完成\n")
    
    sftp.close()
    
    # 4. 安装依赖
    print("=== 4. 安装依赖 ===")
    out, err = run_cmd(ssh, f"cd {REMOTE_DIR} && npm install 2>&1")
    print(out)
    print("✅ 依赖安装完成\n")
    
    # 5. 导入表结构
    print("=== 5. 导入表结构 ===")
    out, err = run_cmd(ssh, f"cd {REMOTE_DIR} && mysql -u ks_user -p'{DB_PASSWORD}' ks < schema.mysql.sql 2>&1")
    if err and "ERROR" in err:
        print(f"⚠️ {err}")
    else:
        print("✅ 表结构导入完成\n")
    
    # 6. 检查表是否创建成功
    print("=== 6. 验证数据库 ===")
    out, err = run_cmd(ssh, f"mysql -u ks_user -p'{DB_PASSWORD}' ks -e 'SHOW TABLES;'")
    print(out)
    
    ssh.close()
    print("\n🎉 部署完成！")
    print(f"下一步：启动服务并配置 Nginx")

if __name__ == "__main__":
    main()
