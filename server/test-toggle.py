import requests
import json

# 测试禁用题库
r = requests.put(
    'http://127.0.0.1:3001/api/admin/bank/c-language-basics/toggle',
    json={'enabled': False},
    headers={
        'X-Admin-Device-Id': '2448a6cc-24aa-4677-9e99-6337060b80ca',
        'X-Admin-Password': '19989123549'
    }
)
print('禁用结果:', r.json())

# 检查 API
r = requests.get('http://127.0.0.1:3001/api/banks?all=true')
data = r.json()
print('\nAPI 返回:')
for b in data['banks']:
    print(f"  {b['id']}: enabled={b['enabled']}")
