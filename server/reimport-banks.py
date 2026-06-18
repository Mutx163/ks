#!/usr/bin/env python3
"""从 D1 导出题库并导入到 MySQL"""
import subprocess
import json
import mysql.connector
import sys

# MySQL 配置
MYSQL_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'ks_user',
    'password': 'Ks@2024!Secure',
    'database': 'ks',
    'charset': 'utf8mb4'
}

def export_from_d1():
    """从 D1 导出所有题库"""
    print("📤 从 D1 导出题库数据...")
    
    # 导出题库基本信息
    result = subprocess.run(
        ['npx', 'wrangler', 'd1', 'execute', 'ks-leaderboard', '--command', 
         "SELECT id, name, description, category, version, question_count, allowed_modes, enabled, updated_at FROM banks", 
         '--remote'],
        capture_output=True, text=True, cwd='D:/Users/34045/Desktop/cursor/html/ks'
    )
    
    # 解析输出（跳过前几行 wrangler 日志）
    lines = result.stdout.strip().split('\n')
    json_start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('['):
            json_start = i
            break
    
    if json_start == -1:
        print("❌ 无法解析 D1 输出")
        print("stdout:", result.stdout[:500])
        print("stderr:", result.stderr[:500])
        return None
    
    json_text = '\n'.join(lines[json_start:])
    data = json.loads(json_text)
    banks = data[0]['results']
    print(f"✅ 从 D1 导出 {len(banks)} 个题库")
    return banks

def export_questions_from_d1(bank_ids):
    """从 D1 导出题库的题目数据"""
    all_questions = {}
    
    for bank_id in bank_ids:
        print(f"📤 导出题库 {bank_id} 的题目...")
        result = subprocess.run(
            ['npx', 'wrangler', 'd1', 'execute', 'ks-leaderboard', '--command', 
             f"SELECT * FROM questions WHERE bank_id = '{bank_id}'", 
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
            print(f"⚠️ 题库 {bank_id} 没有题目数据")
            continue
        
        json_text = '\n'.join(lines[json_start:])
        data = json.loads(json_text)
        questions = data[0]['results']
        all_questions[bank_id] = questions
        print(f"✅ 导出 {len(questions)} 道题目")
    
    return all_questions

def import_to_mysql(banks, questions):
    """导入到 MySQL"""
    print("\n📥 导入到 MySQL...")
    
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor()
    
    # 导入题库基本信息
    for bank in banks:
        try:
            # 检查是否已存在
            cursor.execute("SELECT id FROM banks WHERE id = %s", (bank['id'],))
            exists = cursor.fetchone()
            
            if exists:
                # 更新
                cursor.execute("""
                    UPDATE banks SET 
                        name = %s, description = %s, category = %s, 
                        version = %s, question_count = %s, allowed_modes = %s,
                        enabled = %s, updated_at = %s
                    WHERE id = %s
                """, (
                    bank['name'], bank.get('description', ''), bank.get('category', ''),
                    bank.get('version', 1), bank.get('question_count', 0),
                    bank.get('allowed_modes'), bank.get('enabled', 1),
                    bank.get('updated_at'), bank['id']
                ))
                print(f"  更新题库: {bank['id']} - {bank['name']}")
            else:
                # 插入
                cursor.execute("""
                    INSERT INTO banks (id, name, description, category, version, 
                        question_count, allowed_modes, enabled, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    bank['id'], bank['name'], bank.get('description', ''),
                    bank.get('category', ''), bank.get('version', 1),
                    bank.get('question_count', 0), bank.get('allowed_modes'),
                    bank.get('enabled', 1), bank.get('updated_at')
                ))
                print(f"  新增题库: {bank['id']} - {bank['name']}")
        except Exception as e:
            print(f"  ❌ 导入题库 {bank['id']} 失败: {e}")
    
    # 导入题目（如果有 questions 表）
    if questions:
        try:
            # 检查 questions 表是否存在
            cursor.execute("SHOW TABLES LIKE 'questions'")
            if cursor.fetchone():
                for bank_id, qs in questions.items():
                    for q in qs:
                        try:
                            cursor.execute("""
                                INSERT INTO questions (id, bank_id, type, question, options, answer, explanation, created_at)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                                ON DUPLICATE KEY UPDATE
                                    question = VALUES(question), options = VALUES(options),
                                    answer = VALUES(answer), explanation = VALUES(explanation)
                            """, (
                                q.get('id'), q.get('bank_id'), q.get('type'),
                                q.get('question'), q.get('options'), q.get('answer'),
                                q.get('explanation'), q.get('created_at')
                            ))
                        except Exception as e:
                            print(f"  ⚠️ 跳过题目 {q.get('id')}: {e}")
                    print(f"  ✅ 导入 {bank_id} 的 {len(qs)} 道题目")
            else:
                print("  ⚠️ questions 表不存在，跳过题目导入")
        except Exception as e:
            print(f"  ❌ 导入题目失败: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()
    print("\n✅ 导入完成!")

def main():
    # 1. 从 D1 导出题库
    banks = export_from_d1()
    if not banks:
        print("❌ 导出失败")
        return
    
    # 2. 导出题目数据
    bank_ids = [b['id'] for b in banks]
    questions = export_questions_from_d1(bank_ids)
    
    # 3. 导入到 MySQL
    import_to_mysql(banks, questions)
    
    # 4. 验证
    print("\n📊 验证导入结果:")
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, question_count, enabled FROM banks")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} ({row[2]}题, {'启用' if row[3] else '禁用'})")
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
