import mysql from 'mysql2/promise';

// 创建数据库连接池
const pool = mysql.createPool({
  host: 'localhost',
  user: 'yuncang',
  password: 'NeGAj5awAn7bfWit',
  database: 'yuncang',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool; 