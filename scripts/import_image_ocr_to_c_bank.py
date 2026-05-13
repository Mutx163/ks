import json
import re
from pathlib import Path

OCR_FILES = [
    'ocr-batch-1-10.md',
    'ocr-batch-11-20.md',
    'ocr-batch-21-30.md',
    'ocr-batch-31-40.md',
]
BANK_PATH = Path('banks/c-language.json')
BACKUP_PATH = Path('banks/c-language.before-image-import.bak')
IMAGE_PREFIX = '夸克扫描王_该函数使用输出'

raw = []
for file in OCR_FILES:
    with open(file, encoding='utf-8') as f:
        items = json.load(f)
    for item in items:
        item['_batch'] = file
        raw.append(item)

LETTER_RE = re.compile(r'[A-D]')
IMG_NUM_RE = re.compile(r'\((\d+)\)')


def image_numbers(source: str):
    return [int(n) for n in IMG_NUM_RE.findall(source or '')]


def category_of(item):
    nums = image_numbers(item.get('source', ''))
    n = min(nums) if nums else 0
    qno = str(item.get('imageQuestionNo', ''))
    typ = item.get('type', '')
    if '编程' in typ or '程序题' in qno or '编程题' in qno:
        if n >= 34:
            return '数组与字符串'
        if n >= 21:
            return '循环结构'
        if n >= 16:
            return '选择结构'
        return '编程练习'
    if n <= 2:
        return '程序结构'
    if 3 <= n <= 8:
        return '数据类型与表达式'
    if 9 <= n <= 15:
        return '输入输出与表达式'
    if 16 <= n <= 20:
        return '选择结构'
    if 21 <= n <= 33:
        return '循环结构'
    if n >= 34:
        return '数组与字符串'
    if qno.startswith('习题1'):
        return '程序结构'
    if qno.startswith('习题2'):
        return '数据类型与表达式'
    return '基础语法'


def difficulty_of(item, cat):
    q = item.get('question', '')
    notes = str(item.get('notes', ''))
    if any(s in q for s in ['程序运行', '输出结果', '#include', 'switch', 'for(', 'while', '执行以下程序']):
        return 2
    if any(s in notes for s in ['未定义', '严格', '不一致']):
        return 3
    return 1


def clean_question(q):
    q = (q or '').strip()
    q = q.replace('（ ）()。', '（ ）。').replace('（ ）()', '（ ）。')
    q = q.replace('。#include', '。\n#include')
    q = q.replace('？#include', '？\n#include')
    q = q.replace('：#include', '：\n#include')
    if '#include' in q and '```' not in q:
        idx = q.find('#include')
        prefix = q[:idx].rstrip()
        code = q[idx:].strip()
        q = f'{prefix}\n```c\n{code}\n```'
    return q


def option_list(opts):
    if not opts:
        return []
    if isinstance(opts, dict):
        out = []
        for k in ['A', 'B', 'C', 'D', 'E', 'F']:
            if k in opts:
                out.append(f'{k}. {str(opts[k]).strip()}')
        return out
    if isinstance(opts, list):
        return opts
    return []


def answer_from(ans):
    if not isinstance(ans, dict):
        return None
    verified = ans.get('verified')
    handwritten = ans.get('handwritten')
    chosen = ''
    if isinstance(verified, str) and verified.strip() and not any(bad in verified for bad in ['无法', '无匹配', '无错误项']) and not verified.startswith('未定义行为'):
        chosen = verified
    elif isinstance(handwritten, str) and handwritten.strip():
        chosen = handwritten
    elif isinstance(verified, str):
        chosen = verified
    letters = []
    for letter in LETTER_RE.findall(chosen[:24]):
        if letter not in letters:
            letters.append(letter)
    if not letters:
        return None
    return letters[0] if len(letters) == 1 else letters


def explanation(item, ans, cat, qtype):
    notes = (item.get('notes') or '').strip()
    if qtype == 'fill':
        text = '本题为开放编程题，答案不唯一。解题时先明确输入、处理和输出三步，再选择合适的数据类型、分支/循环或数组实现。记忆：编程题先画 IPO——Input 输入、Process 处理、Output 输出。'
        if notes:
            text += f' 原图备注：{notes}'
        return text
    ans_text = '、'.join(ans) if isinstance(ans, list) else str(ans)
    tips = {
        '程序结构': '记忆：C 程序执行从 main 开始，函数是组成单位，语句常以分号收尾。',
        '数据类型与表达式': '记忆：标识符看“字母/下划线开头”，表达式看“类型、优先级、结合性”。',
        '输入输出与表达式': '记忆：printf 看格式符，scanf 看地址符 &，普通字符必须原样匹配。',
        '选择结构': '记忆：else 就近配对，switch 无 break 会继续向下执行。',
        '循环结构': '记忆：先判断循环看入口，do-while 先执行一次；break 跳出，continue 跳本轮。',
        '数组与字符串': '记忆：数组下标从 0 开始，字符串以 \\0 结束，字符数组不能用 = 整体赋值。',
    }
    text = f'本题考查{cat}。正确答案是 {ans_text}。'
    if notes:
        text += notes
    text += ' ' + tips.get(cat, '记忆：先找考点，再按 C 语法逐步推导。')
    return text


# 跨页题修复：把两个 OCR 碎片合并成完整题目。
repair_items = [
    {
        'source': f'{IMAGE_PREFIX}(10).jpeg; {IMAGE_PREFIX}(11).jpeg',
        'imageQuestionNo': '习题3.1-15',
        'type': '选择题',
        'question': '以下程序的功能是：给 r 输入数据后计算半径为 r 的圆面积 s。程序在编译时出错，出错的原因是（ ）。\n```c\n#include <stdio.h>\nint main(){\n    int r;\n    float s;\n    scanf("%d", &r);\n    s = *p * r * r;\n    printf("s = %f\\n", s);\n    return 0;\n}\n```',
        'options': {'A': '注释语句书写位置错误', 'B': '存放圆半径的变量 r 不应该定义为整型', 'C': 's = *p * r * r; 语句中使用了非法变量', 'D': '输出语句中格式描述符非法'},
        'answer': {'verified': 'C', 'handwritten': 'C'},
        'notes': '跨页题已合并；*p 中 p 未定义/不是合法可用变量。',
    },
    {
        'source': f'{IMAGE_PREFIX}(30).jpeg; {IMAGE_PREFIX}(31).jpeg',
        'imageQuestionNo': '循环结构-34',
        'type': '选择题',
        'question': '以下程序的输出结果是（ ）。\n```c\n#include <stdio.h>\nint main(){\n    int a=1,b;\n    for(b=1;b<=10;b++){\n        if(a>=8) break;\n        if(a%2==1){\n            a+=5;\n            continue;\n        }\n        a-=3;\n    }\n    printf("%d\\n", b);\n    return 0;\n}\n```',
        'options': {'A': '3', 'B': '4', 'C': '5', 'D': '6'},
        'answer': {'verified': 'B', 'handwritten': 'B'},
        'notes': '跨页题已合并；循环在 b=4 时因 a>=8 执行 break。',
    },
]

skip = set()
for i, item in enumerate(raw):
    batch = item.get('_batch')
    qno = str(item.get('imageQuestionNo'))
    if (batch == 'ocr-batch-1-10.md' and qno == '习题3.1-15') or (batch == 'ocr-batch-11-20.md' and qno == '15'):
        skip.add(i)
    if (batch == 'ocr-batch-21-30.md' and qno == '34') or (batch == 'ocr-batch-31-40.md' and qno == '34'):
        skip.add(i)

converted = []
for i, item in enumerate(raw):
    if i in skip:
        continue
    typ = item.get('type', '')
    opts = option_list(item.get('options'))
    if '选择' in typ:
        if not opts:
            continue
        ans = answer_from(item.get('answer'))
        if not ans:
            continue
        qtype = 'multiple' if isinstance(ans, list) else 'single'
    else:
        qtype = 'fill'
        ans = ['完成']
        opts = []
    cat = category_of(item)
    converted.append({
        'type': qtype,
        'category': cat,
        'tags': ['图片识别', str(item.get('imageQuestionNo', ''))],
        'difficulty': difficulty_of(item, cat),
        'question': ('编程题（开放题，答题框输入“完成”后查看解析）：' if qtype == 'fill' else '') + clean_question(item.get('question', '')),
        'options': opts,
        'answer': ans,
        'explanation': explanation(item, ans, cat, qtype),
        'source': item.get('source', ''),
    })

for item in repair_items:
    opts = option_list(item['options'])
    ans = answer_from(item['answer'])
    cat = category_of(item)
    converted.append({
        'type': 'single',
        'category': cat,
        'tags': ['图片识别', str(item.get('imageQuestionNo', ''))],
        'difficulty': difficulty_of(item, cat),
        'question': clean_question(item['question']),
        'options': opts,
        'answer': ans,
        'explanation': explanation(item, ans, cat, 'single'),
        'source': item['source'],
    })


def sort_key(q):
    nums = image_numbers(q.get('source', ''))
    img = min(nums) if nums else 999
    qnums = re.findall(r'\d+', ' '.join(q.get('tags', [])))
    qn = int(qnums[-1]) if qnums else 999
    return (img, qn, q['question'][:20])

converted.sort(key=sort_key)

with open(BANK_PATH, encoding='utf-8') as f:
    bank = json.load(f)

if not BACKUP_PATH.exists():
    BACKUP_PATH.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding='utf-8')

existing = bank.get('questions', [])
kept = [q for q in existing if not (isinstance(q, dict) and str(q.get('source', '')).startswith(IMAGE_PREFIX))]
start_id = max([q.get('id', 0) for q in kept] or [0]) + 1
for offset, question in enumerate(converted):
    question['id'] = start_id + offset

bank['questions'] = kept + converted
bank['description'] = 'C语言程序设计基础题库（含图片识别导入题目）'
for cat in ['程序结构', '输入输出与表达式', '选择结构', '循环结构', '数组与字符串', '编程练习', '数据类型与表达式']:
    if cat not in bank.setdefault('categories', []):
        bank['categories'].append(cat)

BANK_PATH.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps({
    'converted': len(converted),
    'kept': len(kept),
    'total': len(bank['questions']),
    'types': {t: sum(1 for q in converted if q['type'] == t) for t in ['single', 'multiple', 'fill']},
    'backup': str(BACKUP_PATH),
}, ensure_ascii=False, indent=2))
