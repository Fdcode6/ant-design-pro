"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const database_1 = __importDefault(require("./database"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
(async () => {
    try {
        const [roleColumns] = await database_1.default.query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'role'
    `);
        if (roleColumns[0].count === 0) {
            try {
                await database_1.default.query(`
          ALTER TABLE users 
          ADD COLUMN role VARCHAR(20) DEFAULT 'user'
        `);
                console.log('确保数据库结构完整 - 已添加role字段');
            }
            catch (err) {
                console.error('添加role字段失败:', err);
            }
        }
        else {
            console.log('role字段已存在，无需添加');
        }
        await database_1.default.query(`
      UPDATE users 
      SET role = 'admin' 
      WHERE username = 'admin' AND role != 'admin'
    `);
        console.log('确保管理员角色已设置');
    }
    catch (error) {
        console.error('数据库初始化错误:', error);
    }
})();
app.post('/api/login/account', async (req, res) => {
    try {
        const { username, password, type } = req.body;
        console.log('Login attempt:', { username, password, type });
        const [users] = await database_1.default.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (users.length === 0) {
            return res.json({
                status: 'error',
                type,
                currentAuthority: 'guest',
            });
        }
        const user = users[0];
        if (user.status === 'inactive') {
            console.log('禁止登录 - 用户已被禁用:', username);
            return res.json({
                status: 'error',
                type,
                currentAuthority: 'guest',
                msg: '账号已被禁用，请联系管理员',
            });
        }
        const userRole = user.role || (username === 'admin' ? 'admin' : 'user');
        const userId = user.id;
        return res.json({
            status: 'ok',
            type,
            currentAuthority: userRole,
            userId: userId,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ status: 'error', error: 'Internal server error' });
    }
});
app.use('/api/login/outLogin', (req, res) => {
    try {
        console.log('退出登录请求:', req.method, req.query);
        return res.json({
            data: {},
            success: true,
            message: '退出成功',
        });
    }
    catch (error) {
        console.error('退出登录错误:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.get('/api/currentUser', async (req, res) => {
    try {
        const userId = req.query.userId || '1';
        console.log('接收到获取用户信息请求，userId:', userId);
        console.log('正在查询用户信息...');
        const [users] = await database_1.default.query('SELECT id, username, real_name, role, status FROM users WHERE id = ?', [userId]);
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
        if (user.status === 'inactive') {
            console.log('用户已被禁用:', userId);
            return res.status(403).json({
                success: false,
                error: '账号已被禁用，请联系管理员',
            });
        }
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
    }
    catch (error) {
        console.error('Error fetching current user:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.get('/api/users', async (req, res) => {
    try {
        const { current = 1, pageSize = 10, username, status } = req.query;
        let query = 'SELECT id, username, real_name as realName, balance, status, role, created_at as createdAt, updated_at as updatedAt FROM users WHERE 1=1';
        const params = [];
        if (username) {
            query += ' AND username LIKE ?';
            params.push(`%${username}%`);
        }
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        const countQuery = query.replace('SELECT id, username, real_name as realName, balance, status, role, created_at as createdAt, updated_at as updatedAt', 'SELECT COUNT(*) as total');
        const [countResult] = await database_1.default.query(countQuery, params);
        const total = countResult[0].total;
        query += ' LIMIT ? OFFSET ?';
        params.push(Number(pageSize), (Number(current) - 1) * Number(pageSize));
        const [rows] = await database_1.default.query(query, params);
        console.log('用户列表数据:', rows);
        return res.json({
            data: rows,
            success: true,
            total,
            pageSize: Number(pageSize),
            current: Number(current),
        });
    }
    catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('接收到获取单个用户信息请求，userId:', id);
        const [users] = await database_1.default.query('SELECT id, username, real_name as realName, balance, status, role, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?', [id]);
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
    }
    catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.post('/api/users', async (req, res) => {
    try {
        const { username, realName, password, initialBalance, role = 'user' } = req.body;
        let query = 'INSERT INTO users (username, real_name, password, balance, status, role';
        let placeholders = '(?, ?, ?, ?, ?, ?';
        const params = [username, realName, password, initialBalance, 'active', role];
        query += ') VALUES ' + placeholders + ')';
        const [result] = await database_1.default.query(query, params);
        const [users] = await database_1.default.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        res.json({ success: true, data: users[0] });
    }
    catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, realName, status, role } = req.body;
        console.log('Updating user:', { id, username, realName, status, role });
        let query = 'UPDATE users SET username = ?, real_name = ?, status = ?';
        const params = [username, realName, status || 'active'];
        if (role) {
            query += ', role = ?';
            params.push(role);
        }
        query += ' WHERE id = ?';
        params.push(id);
        await database_1.default.query(query, params);
        return res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.post('/api/users/:id/balance', async (req, res) => {
    console.log('收到余额调整请求:', Object.assign({ id: req.params.id }, req.body));
    const connection = await database_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { type, amount, reason = '' } = req.body;
        const operator = 'admin';
        console.log('处理余额调整:', { id, type, amount, reason });
        const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [id]);
        if (!users || users.length === 0) {
            console.error('用户不存在:', id);
            await connection.rollback();
            return res.status(404).json({ success: false, error: '用户不存在' });
        }
        const currentBalance = users[0].balance;
        console.log('当前余额:', currentBalance);
        const numAmount = parseFloat(amount);
        console.log('转换后的金额:', numAmount, '类型:', typeof numAmount);
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
        await connection.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, id]);
        console.log('已更新用户余额');
        const [result] = await connection.query('INSERT INTO transactions (user_id, type, amount, balance, reason, operator) VALUES (?, ?, ?, ?, ?, ?)', [id, type, numAmount, newBalance, reason, operator]);
        console.log('已记录交易:', result);
        await connection.commit();
        console.log('事务已提交，余额调整成功');
        return res.json({ success: true });
    }
    catch (error) {
        await connection.rollback();
        console.error('余额调整错误:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
    finally {
        connection.release();
    }
});
app.get('/api/transactions', async (req, res) => {
    try {
        console.log('Received request for transactions:', req.query);
        const page = parseInt(req.query.page) || parseInt(req.query.current) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const username = req.query.username;
        const type = req.query.type;
        const startTime = req.query.startTime;
        const endTime = req.query.endTime;
        const userId = req.query.userId;
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
        const params = [];
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
        const totalQuery = query.replace('SELECT \n        t.id, \n        t.user_id, \n        u.username, \n        t.type, \n        t.amount, \n        t.balance, \n        t.reason, \n        t.operator, \n        t.created_at', 'SELECT COUNT(*) as total');
        const [totalRows] = await database_1.default.query(totalQuery, params);
        const total = totalRows[0].total;
        query += " ORDER BY t.created_at DESC LIMIT ? OFFSET ?";
        params.push(pageSize, offset);
        const [rows] = await database_1.default.query(query, params);
        console.log(`Found ${rows.length} transaction records`);
        res.json({
            data: rows,
            total,
            success: true,
        });
    }
    catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions',
            error: error.message,
        });
    }
});
app.get('/api/users/options', async (_req, res) => {
    try {
        console.log('Received request for user options');
        const query = `
      SELECT id, username, real_name as realName
      FROM users
      WHERE status = 'active'
      ORDER BY username
    `;
        const [rows] = await database_1.default.query(query);
        console.log(`Found ${rows.length} users for options`);
        res.json({
            data: rows,
            success: true,
        });
    }
    catch (error) {
        console.error('Error fetching user options:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user options',
            error: error.message,
        });
    }
});
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}, listening on all interfaces`);
});
//# sourceMappingURL=index.js.map