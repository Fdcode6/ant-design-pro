import mysql from 'mysql2/promise';

// 创建数据库连接池 - 支持环境变量配置
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'yuncang',
  password: process.env.DB_PASSWORD || 'NeGAj5awAn7bfWit',
  database: process.env.DB_DATABASE || 'yuncang',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('数据库连接配置:', {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'yuncang',
  database: process.env.DB_DATABASE || 'yuncang'
});

export default pool; 