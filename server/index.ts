import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pool from './database';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  real_name: string;
  balance: number;
  status: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

interface TransactionRow extends RowDataPacket {
  id: number;
  user_id: number;
  username: string;
  type: 'increase' | 'decrease';
  amount: number;
  balance: number;
  reason: string;
  operator: string;
  created_at: Date;
}

const app = express();

app.use(cors());
app.use(bodyParser.json());

// 数据库结构初始化
(async () => {
  try {
    // 先检查role字段是否存在
    const [roleColumns] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'role'
    `);

    // 如果字段不存在，则添加
    if (roleColumns[0].count === 0) {
      try {
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN role VARCHAR(20) DEFAULT 'user'
        `);
        console.log('确保数据库结构完整 - 已添加role字段');
      } catch (err) {
        console.error('添加role字段失败:', err);
      }
    } else {
      console.log('role字段已存在，无需添加');
    }

    // 设置admin用户角色
    await pool.query(`
      UPDATE users 
      SET role = 'admin' 
      WHERE username = 'admin' AND role != 'admin'
    `);
    console.log('确保管理员角色已设置');
  } catch (error) {
    console.error('数据库初始化错误:', error);
  }
})();

// 登录API
app.post('/api/login/account', async (req, res) => {
  try {
    const { username, password, type } = req.body;
    console.log('Login attempt:', { username, password, type });

    // 查询用户
    const [users] = await pool.query<UserRow[]>(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, password]
    );

    if (users.length === 0) {
      return res.json({
        status: 'error',
        type,
        currentAuthority: 'guest',
      });
    }

    const user = users[0];

    // 检查用户状态，如果被禁用则拒绝登录
    if (user.status === 'inactive') {
      console.log('禁止登录 - 用户已被禁用:', username);
      return res.json({
        status: 'error',
        type,
        currentAuthority: 'guest',
        msg: '账号已被禁用，请联系管理员',
      });
    }

    // 登录成功，使用数据库中存储的角色
    const userRole = user.role || (username === 'admin' ? 'admin' : 'user');
    const userId = user.id;

    return res.json({
      status: 'ok',
      type,
      currentAuthority: userRole,
      userId: userId,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ status: 'error', error: 'Internal server error' });
  }
});

// 退出登录API
app.use('/api/login/outLogin', (req, res) => {
  try {
    console.log('退出登录请求:', req.method, req.query);
    // 这里可以添加token失效等逻辑
    return res.json({
      data: {},
      success: true,
      message: '退出成功',
    });
  } catch (error) {
    console.error('退出登录错误:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 获取当前用户信息
app.get('/api/currentUser', async (req, res) => {
  try {
    // 从请求中获取用户ID
    const userId = req.query.userId || '1'; // 默认为1，实际应从token获取
    console.log('接收到获取用户信息请求，userId:', userId);

    // 查询用户信息
    console.log('正在查询用户信息...');
    const [users] = await pool.query<UserRow[]>(
      'SELECT id, username, real_name, role, status FROM users WHERE id = ?',
      [userId]
    );
    console.log('查询结果:', users);

    if (users.length === 0) {
      console.log('用户不存在:', userId);
      return res.status(404).json({
        success: false,
        error: '用户不存在',
      });
    }

    const user = users[0];
    console.log('找到用户:', user);

    // 检查用户状态，如果被禁用则拒绝访问
    if (user.status === 'inactive') {
      console.log('用户已被禁用:', userId);
      return res.status(403).json({
        success: false,
        error: '账号已被禁用，请联系管理员',
      });
    }

    // 使用数据库中存储的角色，如果没有则根据用户名判断
    const role = user.role || (user.username === 'admin' ? 'admin' : 'user');

    const userData = {
      name: user.real_name || user.username,
      avatar: 'https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png',
      userid: user.id.toString(),
      email: `${user.username}@example.com`,
      signature: '芊寻云仓通',
      title: role === 'admin' ? '管理员' : '普通用户',
      group: '芊寻科技',
      access: role,
      status: user.status,
    };

    console.log('返回用户数据:', userData);

    return res.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 获取用户列表
app.get('/api/users', async (req, res) => {
  try {
    const { current = 1, pageSize = 10, username, status } = req.query;
    let query = 'SELECT id, username, real_name as realName, balance, status, role, created_at as createdAt, updated_at as updatedAt FROM users WHERE 1=1';
    const params: any[] = [];

    if (username) {
      query += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    const countQuery = query.replace('SELECT id, username, real_name as realName, balance, status, role, created_at as createdAt, updated_at as updatedAt', 'SELECT COUNT(*) as total');
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    query += ' LIMIT ? OFFSET ?';
    params.push(Number(pageSize), (Number(current) - 1) * Number(pageSize));

    const [rows] = await pool.query<UserRow[]>(query, params);
    console.log('用户列表数据:', rows);
    return res.json({
      data: rows,
      success: true,
      total,
      pageSize: Number(pageSize),
      current: Number(current),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 获取单个用户信息
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('接收到获取单个用户信息请求，userId:', id);

    // 查询用户信息
    const [users] = await pool.query<UserRow[]>(
      'SELECT id, username, real_name as realName, balance, status, role, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      console.log('用户不存在:', id);
      return res.status(404).json({
        success: false,
        error: '用户不存在',
      });
    }

    const user = users[0];
    console.log('找到用户:', user);

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 创建用户
app.post('/api/users', async (req, res) => {
  try {
    const { username, realName, password, initialBalance, role = 'user' } = req.body;

    // 构建查询
    let query = 'INSERT INTO users (username, real_name, password, balance, status, role';
    let placeholders = '(?, ?, ?, ?, ?, ?';
    const params: any[] = [username, realName, password, initialBalance, 'active', role];

    // 完成查询
    query += ') VALUES ' + placeholders + ')';

    const [result] = await pool.query<ResultSetHeader>(query, params);
    const [users] = await pool.query<UserRow[]>('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 更新用户
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, realName, status, role } = req.body;
    console.log('Updating user:', { id, username, realName, status, role });

    // 构建更新查询
    let query = 'UPDATE users SET username = ?, real_name = ?, status = ?';
    const params: any[] = [username, realName, status || 'active'];

    // 如果提供了角色，则添加到更新中
    if (role) {
      query += ', role = ?';
      params.push(role);
    }

    // 添加WHERE条件
    query += ' WHERE id = ?';
    params.push(id);

    await pool.query(query, params);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 调整用户余额
app.post('/api/users/:id/balance', async (req, res) => {
  console.log('收到余额调整请求:', { id: req.params.id, ...req.body });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { type, amount, reason = '' } = req.body;
    const operator = 'admin'; // 这里应该从认证信息中获取

    console.log('处理余额调整:', { id, type, amount, reason });

    // 获取当前余额
    const [users] = await connection.query<UserRow[]>('SELECT * FROM users WHERE id = ?', [id]);

    if (!users || users.length === 0) {
      console.error('用户不存在:', id);
      await connection.rollback();
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const currentBalance = users[0].balance;
    console.log('当前余额:', currentBalance);

    // 计算新余额
    const numAmount = parseFloat(amount as string);
    console.log('转换后的金额:', numAmount, '类型:', typeof numAmount);

    // 确保当前余额也是数字类型
    const currentBalanceNum = parseFloat(currentBalance.toString());
    console.log('转换后的当前余额:', currentBalanceNum, '类型:', typeof currentBalanceNum);

    const newBalance = type === 'increase'
      ? currentBalanceNum + numAmount
      : currentBalanceNum - numAmount;

    console.log('新余额:', newBalance, '类型:', typeof newBalance);

    if (newBalance < 0) {
      console.error('余额不足:', { currentBalance, amount, newBalance });
      throw new Error('余额不足');
    }

    // 更新用户余额
    await connection.query(
      'UPDATE users SET balance = ? WHERE id = ?',
      [newBalance, id]
    );
    console.log('已更新用户余额');

    // 记录交易
    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO transactions (user_id, type, amount, balance, reason, operator) VALUES (?, ?, ?, ?, ?, ?)',
      [id, type, numAmount, newBalance, reason, operator]
    );
    console.log('已记录交易:', result);

    await connection.commit();
    console.log('事务已提交，余额调整成功');
    return res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('余额调整错误:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  } finally {
    connection.release();
  }
});

// 获取交易记录
app.get('/api/transactions', async (req, res) => {
  try {
    console.log('Received request for transactions:', req.query);

    // 同时支持current和page参数
    const page = parseInt(req.query.page as string) || parseInt(req.query.current as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const username = req.query.username as string;
    const type = req.query.type as string;
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;
    const userId = req.query.userId as string; // 添加userId参数

    const offset = (page - 1) * pageSize;

    let query = `
      SELECT 
        t.id, 
        t.user_id, 
        u.username, 
        t.type, 
        t.amount, 
        t.balance, 
        t.reason, 
        t.operator, 
        t.created_at
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (username) {
      query += " AND u.username LIKE ?";
      params.push(`%${username}%`);
    }

    if (type) {
      query += " AND t.type = ?";
      params.push(type);
    }

    if (startTime) {
      query += " AND t.created_at >= ?";
      params.push(startTime);
    }

    if (endTime) {
      query += " AND t.created_at <= ?";
      params.push(endTime);
    }

    if (userId) {
      query += " AND t.user_id = ?";
      params.push(userId);
    }

    // 获取总数
    const totalQuery = query.replace('SELECT \n        t.id, \n        t.user_id, \n        u.username, \n        t.type, \n        t.amount, \n        t.balance, \n        t.reason, \n        t.operator, \n        t.created_at', 'SELECT COUNT(*) as total');

    const [totalRows] = await pool.query<RowDataPacket[]>(totalQuery, params);
    const total = totalRows[0].total;

    // 获取数据
    query += " ORDER BY t.created_at DESC LIMIT ? OFFSET ?";
    params.push(pageSize, offset);

    const [rows] = await pool.query<TransactionRow[]>(query, params);
    console.log(`Found ${rows.length} transaction records`);

    res.json({
      data: rows,
      total,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message,
    });
  }
});

// 获取用户选项列表
app.get('/api/users/options', async (_req, res) => {
  try {
    console.log('Received request for user options');

    const query = `
      SELECT id, username, real_name as realName
      FROM users
      WHERE status = 'active'
      ORDER BY username
    `;

    const [rows] = await pool.query<UserRow[]>(query);
    console.log(`Found ${rows.length} users for options`);

    res.json({
      data: rows,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching user options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user options',
      error: error.message,
    });
  }
});

// 获取仪表盘统计数据
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const isAdmin = req.query.isAdmin === 'true';

    console.log('获取仪表盘统计数据:', { userId, isAdmin });

    // 获取当前月份的第一天和最后一天
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let stats: any = {};

    if (isAdmin) {
      // 管理员视图：查看所有数据

      // 总用户数
      const [userCountResult] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as totalUsers FROM users'
      );
      stats.totalUsers = userCountResult[0].totalUsers;

      // 总余额
      const [balanceResult] = await pool.query<RowDataPacket[]>(
        'SELECT SUM(balance) as totalBalance FROM users'
      );
      stats.totalBalance = parseFloat(balanceResult[0].totalBalance) || 0;

      // 本月充值
      const [incomeResult] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as monthlyIncome FROM transactions 
         WHERE type = 'increase' AND created_at >= ? AND created_at <= ?`,
        [firstDayOfMonth, lastDayOfMonth]
      );
      stats.monthlyIncome = parseFloat(incomeResult[0].monthlyIncome) || 0;

      // 本月消费
      const [expenseResult] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as monthlyExpense FROM transactions 
         WHERE type = 'decrease' AND created_at >= ? AND created_at <= ?`,
        [firstDayOfMonth, lastDayOfMonth]
      );
      stats.monthlyExpense = parseFloat(expenseResult[0].monthlyExpense) || 0;

      // 最近6个月的收支趋势
      const [trendsResult] = await pool.query<RowDataPacket[]>(
        `SELECT 
           DATE_FORMAT(created_at, '%Y-%m') as month,
           type,
           SUM(amount) as total
         FROM transactions
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(created_at, '%Y-%m'), type
         ORDER BY month ASC`
      );

      // 格式化趋势数据
      const trends: any[] = [];
      const monthlyData: Record<string, Record<string, number>> = {};

      trendsResult.forEach((row: any) => {
        if (!monthlyData[row.month]) {
          monthlyData[row.month] = { increase: 0, decrease: 0 };
        }
        monthlyData[row.month][row.type] = parseFloat(row.total) || 0;
      });

      Object.keys(monthlyData).sort().forEach(month => {
        trends.push({ date: month, type: '充值', value: monthlyData[month].increase || 0 });
        trends.push({ date: month, type: '消费', value: monthlyData[month].decrease || 0 });
      });

      stats.trends = trends;

    } else {
      // 普通用户视图：只查看自己的数据

      // 用户余额
      const [userResult] = await pool.query<RowDataPacket[]>(
        'SELECT balance FROM users WHERE id = ?',
        [userId]
      );
      stats.totalUsers = 1;
      stats.totalBalance = parseFloat(userResult[0]?.balance) || 0;

      // 本月充值
      const [incomeResult] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as monthlyIncome FROM transactions 
         WHERE user_id = ? AND type = 'increase' AND created_at >= ? AND created_at <= ?`,
        [userId, firstDayOfMonth, lastDayOfMonth]
      );
      stats.monthlyIncome = parseFloat(incomeResult[0].monthlyIncome) || 0;

      // 本月消费
      const [expenseResult] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as monthlyExpense FROM transactions 
         WHERE user_id = ? AND type = 'decrease' AND created_at >= ? AND created_at <= ?`,
        [userId, firstDayOfMonth, lastDayOfMonth]
      );
      stats.monthlyExpense = parseFloat(expenseResult[0].monthlyExpense) || 0;

      // 最近6个月的收支趋势
      const [trendsResult] = await pool.query<RowDataPacket[]>(
        `SELECT 
           DATE_FORMAT(created_at, '%Y-%m') as month,
           type,
           SUM(amount) as total
         FROM transactions
         WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(created_at, '%Y-%m'), type
         ORDER BY month ASC`,
        [userId]
      );

      // 格式化趋势数据
      const trends: any[] = [];
      const monthlyData: Record<string, Record<string, number>> = {};

      trendsResult.forEach((row: any) => {
        if (!monthlyData[row.month]) {
          monthlyData[row.month] = { increase: 0, decrease: 0 };
        }
        monthlyData[row.month][row.type] = parseFloat(row.total) || 0;
      });

      Object.keys(monthlyData).sort().forEach(month => {
        trends.push({ date: month, type: '充值', value: monthlyData[month].increase || 0 });
        trends.push({ date: month, type: '消费', value: monthlyData[month].decrease || 0 });
      });

      stats.trends = trends;
    }

    console.log('统计数据:', stats);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message,
    });
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}, listening on all interfaces`);
}); 