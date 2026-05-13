import json
import re

with open(r'D:\Users\34045\Desktop\cursor\html\ks\banks\c-language.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 只看压缩代码块的完整内容
compressed_ids = [98, 99, 102, 119, 123, 127, 136, 137, 145, 150, 151]

for q in data['questions']:
    qid = q.get('id', '?')
    if qid not in compressed_ids:
        continue
    
    question = q['question']
    blocks = re.findall(r'```c\n(.*?)```', question, re.DOTALL)
    
    print(f"\n{'='*60}")
    print(f"Q{qid} | {q.get('category', '')} | {q.get('tags', [])}")
    print(f"{'='*60}")
    
    # 完整 question 内容
    print(f"question 完整内容:")
    print(question)
    print()
    
    # 提取代码块
    for idx, block in enumerate(blocks):
        print(f"--- 代码块 #{idx+1}（当前格式）---")
        print(block)
        print()
