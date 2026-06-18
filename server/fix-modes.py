import mysql.connector
import json

conn = mysql.connector.connect(
    host='127.0.0.1',
    port=3306,
    user='ks_user',
    password='Ks@2024!Secure',
    database='ks'
)
cursor = conn.cursor()

# 修复 allowed_modes
fixes = {
    'electromechanical-transmission-memorize-supplement': ['review', 'bookmark'],
    'precision-machining-review': ['review']
}

for bank_id, modes in fixes.items():
    modes_json = json.dumps(modes)
    cursor.execute('UPDATE banks SET allowed_modes = %s WHERE id = %s', (modes_json, bank_id))
    print(f'修复 {bank_id}: {modes_json}')

conn.commit()

# 验证
cursor.execute('SELECT id, allowed_modes FROM banks WHERE allowed_modes IS NOT NULL')
for row in cursor.fetchall():
    print(f'{row[0]}: {row[1]}')

cursor.close()
conn.close()
print('修复完成!')
