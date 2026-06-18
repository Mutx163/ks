import paramiko, os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.135.36.100', username='root', password='19989123549Abc')
sftp = ssh.open_sftp()

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    return stdout.read().decode().strip()

# 上传 dist 目录
local_dir = 'D:/Users/34045/Desktop/cursor/html/ks/dist'
remote_dir = '/www/wwwroot/127.0.0.1'

# 上传所有文件
count = 0
for root, dirs, files in os.walk(local_dir):
    for file in files:
        local_path = os.path.join(root, file)
        rel_path = os.path.relpath(local_path, local_dir).replace('\\', '/')
        remote_path = f'{remote_dir}/{rel_path}'
        
        # 创建远程目录
        remote_parent = os.path.dirname(remote_path)
        try:
            sftp.stat(remote_parent)
        except:
            run(f'mkdir -p {remote_parent}')
        
        sftp.put(local_path, remote_path)
        count += 1
        if count % 10 == 0:
            print(f'已上传 {count} 个文件...')

sftp.close()
print(f'共上传 {count} 个文件')

# 重启 PM2
run('export PATH=/www/server/nodejs/v26.3.0/bin:$PATH && pm2 restart ks-api')

# 验证
import time, json
time.sleep(2)
stdin, stdout, stderr = ssh.exec_command('curl -s "http://127.0.0.1:3001/api/health"')
print(f'健康检查: {stdout.read().decode()}')

ssh.close()
print('部署完成!')
