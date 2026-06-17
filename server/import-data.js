#!/usr/bin/env node
/**
 * D1 数据导入 MySQL 脚本
 * 
 * 使用方法：
 *   1. 先运行 export-d1.js 导出数据到 server/d1-export/
 *   2. 配置 .env 文件（参考 env.example）
 *   3. 运行: npm run import
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// 加载环境变量
require('dotenv').config();

const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ks',
    charset: 'utf8mb4'
};

const EXPORT_DIR = path.join(__dirname, 'd1-export');

// 表的导入顺序（考虑外键依赖）
const TABLE_ORDER = [
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

async function main() {
    console.log('🚀 开始导入数据到 MySQL...\n');
    console.log(`📊 数据库: ${config.host}:${config.port}/${config.database}\n`);

    // 检查导出目录
    if (!fs.existsSync(EXPORT_DIR)) {
        console.error('❌ 未找到导出数据目录:', EXPORT_DIR);
        console.error('   请先运行: node export-d1.js');
        process.exit(1);
    }

    // 连接数据库
    const pool = mysql.createPool(config);
    
    try {
        const conn = await pool.getConnection();
        console.log('✅ MySQL 连接成功\n');
        conn.release();
    } catch (e) {
        console.error('❌ MySQL 连接失败:', e.message);
        process.exit(1);
    }

    // 逐表导入
    for (const table of TABLE_ORDER) {
        const jsonPath = path.join(EXPORT_DIR, `${table}.json`);
        
        if (!fs.existsSync(jsonPath)) {
            console.log(`⏭️  跳过表 ${table}（未找到导出文件）`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        if (!data || data.length === 0) {
            console.log(`⏭️  跳过表 ${table}（无数据）`);
            continue;
        }

        console.log(`📦 导入表: ${table} (${data.length} 行)`);

        const columns = Object.keys(data[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const columnNames = columns.map(c => '`' + c + '`').join(', ');
        
        // 使用 INSERT ... ON DUPLICATE KEY UPDATE
        const updates = columns
            .filter(c => !['id', 'user_id', 'device_id'].includes(c))
            .map(c => '`' + c + '` = VALUES(`' + c + '`)')
            .join(', ');

        const sql = `INSERT INTO \`${table}\` (${columnNames}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;

        let success = 0;
        let failed = 0;

        // 批量插入（每批 100 条）
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            
            for (const row of batch) {
                try {
                    const values = columns.map(c => {
                        const val = row[c];
                        if (val === null || val === undefined) return null;
                        if (typeof val === 'object') return JSON.stringify(val);
                        return val;
                    });
                    await pool.execute(sql, values);
                    success++;
                } catch (e) {
                    failed++;
                    if (failed <= 5) {
                        console.error(`   ⚠️  行导入失败: ${e.message}`);
                    }
                }
            }
            
            // 显示进度
            const progress = Math.min(i + batchSize, data.length);
            process.stdout.write(`\r   进度: ${progress}/${data.length}`);
        }
        
        console.log(`\n   ✅ 成功: ${success}, ❌ 失败: ${failed}\n`);
    }

    await pool.end();
    console.log('🎉 数据导入完成！');
}

main().catch(e => {
    console.error('导入失败:', e);
    process.exit(1);
});
