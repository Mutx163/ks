# -*- coding: utf-8 -*-
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open(r'D:\Users\34045\Desktop\cursor\html\ks\banks\c-language.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for q in data['questions']:
    if q.get('id') == 123:
        print("Before:")
        print(repr(q['question']))
        print()
        
        q['question'] = (
            '有以下程序：\n'
            '```c\n'
            '#include <stdio.h>\n'
            'int main(){\n'
            '    int m,n,p;\n'
            '    scanf("m=%dn=%dp=%d", &m,&n,&p);\n'
            '    printf("%d%d%d\\n", m,n,p);\n'
            '    return 0;\n'
            '}\n'
            '```\n'
            '若想使变量 m 中的值为 123，n 中的值为 456，p 中的值为 789，则正确的输入是（ ）。'
        )
        
        print("After:")
        print(q['question'])
        break

with open(r'D:\Users\34045\Desktop\cursor\html\ks\banks\c-language.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("\nQ123 fixed and saved.")
