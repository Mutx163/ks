#!/usr/bin/env python3
"""部署 dist 到 Alpine 服务器"""
import paramiko
import subprocess
import os
import time

DIST_DIR = os.path.join(os.path.dirname(__file__), '..', 'dist')
SERVER = '199.47.242.244'
PORT = 43596
USER = 'root'
PASS = 'm8d5yhrgozyld3uj'
REMOTE_DIR = '/var/www/html'

def main():
    print("=== 部署到 Alpine 服务器 ===\n")
    
    # 打包
    print("打包 dist...")
    subprocess.run(['tar', 'czf', 'dist.tar.gz', '-C', DIST_DIR, '.'], check=True)
    print(f"打包完成: {os.path.getsize('dist.tar.gz')} bytes\n")
    
    # SSH 连接
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER, username=USER, password=PASS, port=PORT, timeout=60)
    
    def run(cmd, timeout=30):
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
        return stdout.read().decode('utf-8', errors='ignore').strip(), stderr.read().decode('utf-8', errors='ignore').strip()
    
    # 上传
    print("上传 dist.tar.gz...")
    sftp = ssh.open_sftp()
    sftp.put('dist.tar.gz', '/tmp/dist.tar.gz')
    sftp.close()
    print("上传完成\n")
    
    # 解压
    print("解压到", REMOTE_DIR)
    run(f'rm -rf {REMOTE_DIR}/*')
    run(f'cd {REMOTE_DIR} && tar xzf /tmp/dist.tar.gz')
    run('rm /tmp/dist.tar.gz')
    
    # 重启 API
    print("重启 API 服务...")
    run('sh /opt/ks-api/stop.sh')
    time.sleep(1)
    run('sh /opt/ks-api/start.sh')
    time.sleep(2)
    
    # 验证
    out, _ = run('curl -s http://localhost:3001/api/health')
    print(f'\n健康检查: {out}')
    
    out, _ = run('ls -la /var/www/html/index.html')
    print(f'文件: {out}')
    
    ssh.close()
    print("\n=== 部署完成 ===")
    
    # 清理
    os.remove('dist.tar.gz')

if __name__ == '__main__':
    main()
