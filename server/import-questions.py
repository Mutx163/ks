#!/usr/bin/env python3
"""从 D1 导出 questions_json 并导入到 MySQL"""
import subprocess
import json
import paramiko
import time

def export_from_d1(bank_id):
    """从 D1 导出单个题库的 questions_json"""
    result = subprocess.run(
        ['C:\\Program Files\\nodejs\\npx.cmd', 'wrangler', 'd1', 'execute', 'ks-leaderboard', '--command', 
         f"SELECT id, questions_json FROM banks WHERE id = '{bank_id}'", 
         '--remote'],
        capture_output=True, text=True, cwd='D:/Users/34045/Desktop/cursor/html/ks'
    )
    
    lines = result.stdout.strip().split('\n')
    json_start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('['):
            json_start = i
            break
    
    if json_start == -1:
        return None
    
    json_text = '\n'.join(lines[json_start:])
    data = json.loads(json_text)
    if data[0]['results']:
        return data[0]['results'][0]['questions_json']
    return None

def main():
    # 获取所有题库 ID
    result = subprocess.run(
        ['C:\\Program Files\\nodejs\\npx.cmd', 'wrangler', 'd1', 'execute', 'ks-leaderboard', '--command', 
         "SELECT id FROM banks ORDER BY id", '--remote'],
        capture_output=True, text=True, cwd='D:/Users/34045/Desktop/cursor/html/ks'
    )
    
    lines = result.stdout.strip().split('\n')
    json_start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('['):
            json_start = i
            break
    
    json_text = '\n'.join(lines[json_start:])
    data = json.loads(json_text)
    bank_ids = [r['id'] for r in data[0]['results']]
    
    print(f"共 {len(bank_ids)} 个题库")
    
    # 连接 SSH
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('8.135.36.100', username='root', password='19989123549Abc')
    
    def run(cmd):
        stdin, stdout, stderr = ssh.exec_command(cmd)
        return stdout.read().decode().strip(), stderr.read().decode().strip()
    
    for bank_id in bank_ids:
        print(f"\n处理题库: {bank_id}")
        
        # 从 D1 导出
        questions_json = export_from_d1(bank_id)
        if not questions_json:
            print(f"  ⚠️ 没有题目数据")
            continue
        
        print(f"  导出 {len(questions_json)} 字符")
        
        # 转义单引号
        escaped_json = questions_json.replace("\\", "\\\\").replace("'", "\\'")
        
        # 写入临时 SQL 文件
        sql = f"UPDATE banks SET questions_json = '{escaped_json}' WHERE id = '{bank_id}';"
        
        with open(f'D:/Users/34045/Desktop/cursor/html/ks/server/update-{bank_id}.sql', 'w', encoding='utf-8') as f:
            f.write(sql)
        
        # 上传到服务器
        sftp = ssh.open_sftp()
        sftp.put(f'D:/Users/34045/Desktop/cursor/html/ks/server/update-{bank_id}.sql', f'/tmp/update-{bank_id}.sql')
        sftp.close()
        
        # 执行 SQL
        out, err = run(f'''mysql -u ks_user -p'Ks@2024!Secure' ks < /tmp/update-{bank_id}.sql 2>&1''')
        if err and 'Warning' not in err:
            print(f"  ❌ 错误: {err}")
        else:
            print(f"  ✅ 导入成功")
    
    # 验证
    print("\n验证结果:")
    out, _ = run('''mysql -u ks_user -p'Ks@2024!Secure' ks -e \"SELECT id, question_count, LENGTH(questions_json) as json_len FROM banks ORDER BY id;\"''')
    print(out)
    
    # 重启 PM2
    run('export PATH=/www/server/nodejs/v26.3.0/bin:$PATH && pm2 restart ks-api')
    print("\n✅ PM2 已重启")
    
    ssh.close()

if __name__ == '__main__':
    main()
