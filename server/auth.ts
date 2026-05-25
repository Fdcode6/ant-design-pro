import type { NextFunction, Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2';
import pool from './database';

export interface AuthUser {
  id: number;
  username: string;
  realName: string;
  role: string;
  status: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

export type BalanceAdjustmentType = 'increase' | 'decrease';

export interface NormalizedBalanceAdjustment {
  type: BalanceAdjustmentType;
  amount: number;
  reason: string;
}

interface AuthUserRow extends RowDataPacket {
  id: number;
  username: string;
  real_name: string;
  role: string | null;
  status: string;
}

interface RevokedTokenRow extends RowDataPacket {
  token_hash: string;
}

const DEFAULT_JWT_SECRET = 'local-dev-yuncang-secret-change-me';

let revokedTokensTableReady: Promise<void> | null = null;

export const getJwtSecret = () => process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

export const signAccessToken = (user: Pick<AuthUser, 'id' | 'username' | 'role'>) => {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn'];

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      jti: randomUUID(),
    },
    getJwtSecret(),
    { expiresIn },
  );
};

export const parseBearerToken = (authorization?: string | string[]) => {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

export const hashAccessToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const getTokenExpiresAt = (token: string) => {
  const payload = jwt.decode(token) as JwtPayload | null;
  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }

  return new Date(payload.exp * 1000);
};

export const ensureRevokedTokensTable = async () => {
  if (!revokedTokensTableReady) {
    revokedTokensTableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS revoked_tokens (
          token_hash CHAR(64) PRIMARY KEY,
          user_id INT NULL,
          username VARCHAR(50) NULL,
          expires_at TIMESTAMP NOT NULL,
          revoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_revoked_tokens_expires_at (expires_at)
        )
      `)
      .then(() => undefined);
  }

  return revokedTokensTableReady;
};

export const pruneExpiredRevokedTokens = async () => {
  await ensureRevokedTokensTable();
  await pool.query('DELETE FROM revoked_tokens WHERE expires_at <= NOW()');
};

export const isTokenRevoked = async (token: string) => {
  await ensureRevokedTokensTable();

  const [rows] = await pool.query<RevokedTokenRow[]>(
    'SELECT token_hash FROM revoked_tokens WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
    [hashAccessToken(token)],
  );

  return rows.length > 0;
};

export const revokeAccessToken = async (token: string, user?: Pick<AuthUser, 'id' | 'username'>) => {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch (error) {
    return false;
  }

  const expiresAt = getTokenExpiresAt(token);
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return false;
  }

  await ensureRevokedTokensTable();

  const payloadUserId = Number(payload.id);
  const userId = user?.id ?? (Number.isInteger(payloadUserId) && payloadUserId > 0 ? payloadUserId : null);
  const username =
    user?.username ??
    (typeof payload.username === 'string' && payload.username.trim() ? payload.username : null);

  await pool.query(
    `
      INSERT INTO revoked_tokens (token_hash, user_id, username, expires_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        username = VALUES(username),
        expires_at = VALUES(expires_at),
        revoked_at = CURRENT_TIMESTAMP
    `,
    [hashAccessToken(token), userId, username, expiresAt],
  );

  await pruneExpiredRevokedTokens();
  return true;
};

export const isAdminUser = (user?: Pick<AuthUser, 'role'> | null) => user?.role === 'admin';

export const canAccessUser = (user: Pick<AuthUser, 'id' | 'role'> | undefined, targetUserId: number) => {
  if (!user || !Number.isInteger(targetUserId) || targetUserId <= 0) {
    return false;
  }

  return isAdminUser(user) || user.id === targetUserId;
};

export const normalizeBalanceAdjustment = (input: {
  type?: unknown;
  amount?: unknown;
  reason?: unknown;
}): NormalizedBalanceAdjustment => {
  if (input.type !== 'increase' && input.type !== 'decrease') {
    throw new Error('操作类型无效');
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('金额必须大于0');
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) {
    throw new Error('操作原因不能为空');
  }

  return {
    type: input.type,
    amount,
    reason,
  };
};

export const getClientIp = (req: Request) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (forwardedIp) {
    return forwardedIp.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip || req.socket.remoteAddress || '';
};

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = parseBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '未登录或登录已过期',
    });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const userId = Number(payload.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        error: '登录信息无效',
      });
    }

    if (await isTokenRevoked(token)) {
      return res.status(401).json({
        success: false,
        error: '登录已退出，请重新登录',
      });
    }

    const [users] = await pool.query<AuthUserRow[]>(
      'SELECT id, username, real_name, role, status FROM users WHERE id = ?',
      [userId],
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: '用户不存在或登录已失效',
      });
    }

    const user = users[0];
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        error: '账号已被禁用，请联系管理员',
      });
    }

    req.authUser = {
      id: user.id,
      username: user.username,
      realName: user.real_name || user.username,
      role: user.role || (user.username === 'admin' ? 'admin' : 'user'),
      status: user.status,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '未登录或登录已过期',
    });
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      error: '未登录或登录已过期',
    });
  }

  if (!isAdminUser(req.authUser)) {
    return res.status(403).json({
      success: false,
      error: '没有管理员权限',
    });
  }

  return next();
};
