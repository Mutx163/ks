# -*- coding: utf-8 -*-
import json
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open(r'D:\Users\34045\Desktop\cursor\html\ks\banks\c-language.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Code expansions for each question
code_expansions = {
    98: '#include <stdio.h>\nint main(){\n    char c;\n    int n=100;\n    float f=10;\n    double x;\n    x = f *= n /= (c=50);\n    printf("%d %f\\n", n, x);\n    return 0;\n}',

    99: '#include <stdio.h>\nint main(){\n    char a,b;\n    a=\'A\'+\'5\'-\'3\';\n    b=a+\'6\'-\'2\';\n    printf("%d%c\\n", a, b);\n    return 0;\n}',

    102: '#include <stdio.h>\nint main(){\n    int x,y,z;\n    x=y=1;\n    z=x++, y++, ++y;\n    printf("%d,%d,%d\\n", x, y, z);\n    return 0;\n}',

    119: '#include <stdio.h>\nint main(){\n    int a=0,b=0,c=0;\n    c=(a-=a-5);\n    (a=b,b+=4);\n    printf("%d,%d,%d", a,b,c);\n    return 0;\n}',

    127: '#include <stdio.h>\nint main(){\n    char c1=\'1\', c2=\'2\';\n    c1=getchar();\n    c2=getchar();\n    putchar(c1);\n    putchar(c2);\n    return 0;\n}',

    136: '#include <stdio.h>\nint main(){\n    int a=2,b=-1,c=2;\n    if(a<b)\n        if(b<0)\n            c=0;\n        else\n            c+=1;\n    printf("%d\\n", c);\n    return 0;\n}',

    137: '#include <stdio.h>\nint main(){\n    int w=4,x=3,y=2,z=1;\n    printf("%d\\n", (w<x ? w : z<y ? z:x));\n    return 0;\n}',

    145: '#include <stdio.h>\nint main(){\n    int x;\n    scanf("%d", &x);\n    if(x<=3);\n    else if(x!=10)\n        printf("%d\\n", x);\n    return 0;\n}',

    150: '#include <stdio.h>\nint main(){\n    int x=1,y=0,a=0,b=0;\n    switch(x){\n        case 1:\n            switch(y){\n                case 0: a++; break;\n                case 1: b++; break;\n            }\n        case 2: a++; b++; break;\n        case 3: a++; b++;\n    }\n    printf("\\na=%d,b=%d", a,b);\n    return 0;\n}',

    151: '#include <stdio.h>\nint main(){\n    int a,b,s;\n    scanf("%d%d", &a,&b);\n    s=a;\n    if(a<b) s=b;\n    s*=s;\n    printf("\\n%d", s);\n    return 0;\n}',
}

fixed_count = 0

for q in data['questions']:
    qid = q.get('id')
    if qid not in code_expansions:
        continue
    
    question = q['question']
    expanded_code = code_expansions[qid]
    
    if qid == 123:
        # Q123: code block has question text mixed in
        # Current: "有以下程序：\n```c\n...code... 若想使变量...正确的输入是（ ）。\n```"
        # Target: "有以下程序：\n```c\n...code...\n```\n若想使变量...正确的输入是（ ）。"
        q['question'] = (
            '\u6709\u4ee5\u4e0b\u7a0b\u5e8f\uff1a\n'
            '```c\n'
            '#include <stdio.h>\n'
            'int main(){\n'
            '    int m,n,p;\n'
            '    scanf("m=%dn=%dp=%d", &m,&n,&p);\n'
            '    printf("%d%d%d\\n", m,n,p);\n'
            '    return 0;\n'
            '}\n'
            '```\n'
            '\u82e5\u60f3\u4f7f\u53d8\u91cf m \u4e2d\u7684\u503c\u4e3a 123\uff0cn \u4e2d\u7684\u503c\u4e3a 456\uff0cp \u4e2d\u7684\u503c\u4e3a 789\uff0c\u5219\u6b63\u786e\u7684\u8f93\u5165\u662f\uff08 \uff09\u3002'
        )
        print(f"Q{qid}: fixed code block + split question text")
        fixed_count += 1
    else:
        # Replace the code block content
        def replace_code_block(match):
            return '```c\n' + expanded_code + '\n```'
        
        new_question = re.sub(r'```c\n.*?```', replace_code_block, question, flags=re.DOTALL)
        if new_question != question:
            q['question'] = new_question
            print(f"Q{qid}: expanded code block")
            fixed_count += 1
        else:
            print(f"Q{qid}: no code block matched, skipped")

with open(r'D:\Users\34045\Desktop\cursor\html\ks\banks\c-language.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nTotal fixed: {fixed_count} questions")
print("File saved.")
