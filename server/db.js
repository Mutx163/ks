/**
 * MySQL 连接池配置
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

// 从环境变量读取配置，或使用默认值
const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ks',
    charset: 'utf8mb4',
    timezone: '+08:00',
    waitForConnections: true,
    connectionLimit: 20,        // 增加连接数
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // 性能优化
    namedPlaceholders: true,
    dateStrings: true,
    // 批量插入优化
    maxPreparedStatements: 100
};

// 创建连接池
const pool = mysql.createPool(config);

// 测试连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL 连接成功');
        connection.release();
        return true;
    } catch (e) {
        console.error('❌ MySQL 连接失败:', e.message);
        return false;
    }
}

module.exports = { pool, testConnection, config };
