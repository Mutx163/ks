#!/usr/bin/env node
/**
 * D1 数据导出脚本
 * 
 * 使用方法：
 *   1. 确保已安装 wrangler: npm install -g wrangler
 *   2. 确保已登录: npx wrangler login
 *   3. 在 worker/ 目录运行: node ../server/export-d1.js
 * 
 * 导出文件：
 *   - server/d1-export/users.json
 *   - server/d1-export/devices.json
 *   - server/d1-export/stats.json
 *   - server/d1-export/banks.json
 *   - server/d1-export/announcements.json
 *   - server/d1-export/bank_history.json
 *   - server/d1-export/app_config.json
 *   - server/d1-export/admin_operation_logs.json
 *   - server/d1-export/client_logs.json
 *   - server/import-to-mysql.sql  (可直接导入 MySQL)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'ks-leaderboard';
const EXPORT_DIR = path.join(__dirname, 'd1-export');

// 确保导出目录存在
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// 要导出的表
const TABLES = [
    'users',
    'devices',
    'stats',
    'banks',
    'announcements',
    'bank_history',
    'app_config',
    'admin_operation_logs',
    'client_logs'
];

/**
 * 执行 D1 查询并返回结果
 */
function queryD1(sql) {
    try {
        // 使用 wrangler d1 execute --command 执行单条 SQL
        const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --command "${sql.replace(/"/g, '\\"')}"`;
        const result = execSync(cmd, { encoding: 'utf-8', cwd: path.join(__dirname, '..') });
        // wrangler 输出的是 JSON 格式
        const lines = result.split('\n');
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (Array.isArray(parsed) && parsed[0]?.results) {
                    return parsed[0].results;
                }
            } catch {}
        }
        return [];
    } catch (e) {
        console.error(`查询失败: ${sql}`);
        console.error(e.message);
        return [];
    }
}

/**
 * 转义 MySQL 字符串
 */
function escapeMySQL(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'object') val = JSON.stringify(val);
    return "'" + String(val)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t') + "'";
}

/**
 * 生成 MySQL INSERT 语句
 */
function generateInsert(table, rows) {
    if (!rows || rows.length === 0) return '';
    
    const columns = Object.keys(rows[0]);
    let sql = `-- ${table}: ${rows.length} 行\n`;
    
    // 使用 INSERT ... ON DUPLICATE KEY UPDATE 处理主键冲突
    for (const row of rows) {
        const values = columns.map(c => escapeMySQL(row[c]));
        const updates = columns
            .filter(c => c !== 'id' && c !== 'user_id' && c !== 'device_id') // 跳过主键
            .map(c => `\`${c}\` = VALUES(\`${c}\`)`)
            .join(', ');
        
        if (table === 'stats') {
            // stats 表的主键是 (user_id, bank_id)
            sql += `INSERT INTO \`${table}\` (${columns.map(c => '`' + c + '`').join(', ')}) VALUES (${values.join(', ')}) ON DUPLICATE KEY UPDATE ${updates};\n`;
        } else {
            sql += `INSERT INTO \`${table}\` (${columns.map(c => '`' + c + '`').join(', ')}) VALUES (${values.join(', ')}) ON DUPLICATE KEY UPDATE ${updates};\n`;
        }
    }
    return sql;
}

async function main() {
    console.log('🚀 开始导出 D1 数据...\n');
    
    let allSQL = `-- ============================================\n`;
    allSQL += `-- 城科卷王 D1 → MySQL 数据导入\n`;
    allSQL += `-- 生成时间: ${new Date().toISOString()}\n`;
    allSQL += `-- ============================================\n\n`;
    allSQL += `SET NAMES utf8mb4;\n`;
    allSQL += `SET CHARACTER SET utf8mb4;\n\n`;
    
    for (const table of TABLES) {
        console.log(`📦 导出表: ${table}`);
        
        const rows = queryD1(`SELECT * FROM ${table}`);
        
        // 保存 JSON
        const jsonPath = path.join(EXPORT_DIR, `${table}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
        console.log(`   ✅ ${rows.length} 行 → ${jsonPath}`);
        
        // 生成 SQL
        allSQL += `-- ==================== ${table} ====================\n`;
        allSQL += generateInsert(table, rows);
        allSQL += '\n';
    }
    
    // 保存 SQL 文件
    const sqlPath = path.join(__dirname, 'import-to-mysql.sql');
    fs.writeFileSync(sqlPath, allSQL);
    console.log(`\n✅ MySQL 导入文件已生成: ${sqlPath}`);
    console.log(`\n📋 导入命令:`);
    console.log(`   mysql -u root -p 数据库名 < ${sqlPath}`);
}

main().catch(console.error);
