const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据目录
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'ks.db');

// 创建数据库连接
const db = new Database(DB_PATH);

// 启用 WAL 模式（提高并发性能）
db.pragma('journal_mode = WAL');

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化表结构
const schemaPath = path.join(__dirname, 'schema.sqlite.sql');
if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
}

// 封装查询方法，兼容 MySQL 的 pool.execute 风格
const pool = {
    // 查询多行：返回 [rows]
    async execute(sql, params = []) {
        try {
            const stmt = db.prepare(sql);
            // 处理参数：将 undefined 转为 null
            const cleanParams = params.map(p => p === undefined ? null : p);
            
            // 判断是查询还是执行
            const trimmed = sql.trim().toUpperCase();
            if (trimmed.startsWith('SELECT')) {
                const rows = stmt.all(...cleanParams);
                return [rows];
            } else if (trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE') || trimmed.startsWith('REPLACE')) {
                const result = stmt.run(...cleanParams);
                return [{ 
                    insertId: result.lastInsertRowid, 
                    affectedRows: result.changes 
                }];
            } else {
                const result = stmt.run(...cleanParams);
                return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }];
            }
        } catch (err) {
            throw err;
        }
    },
    
    // 查询单行
    async query(sql, params = []) {
        const [rows] = await this.execute(sql, params);
        return rows;
    }
};

// 测试连接（兼容 MySQL 版）
async function testConnection() {
    try {
        db.prepare('SELECT 1').get();
        return true;
    } catch (err) {
        console.error('SQLite 连接失败:', err.message);
        return false;
    }
}

// 配置（兼容 MySQL 版）
const config = {
    host: 'sqlite',
    port: 0,
    user: 'local',
    database: DB_PATH
};

// 导出
module.exports = { db, pool, testConnection, config };
