import assert from 'node:assert/strict';
import {
  canAccessUser,
  getClientIp,
  getTokenExpiresAt,
  hashAccessToken,
  isAdminUser,
  normalizeBalanceAdjustment,
  parseBearerToken,
  revokeAccessToken,
  signAccessToken,
} from './auth';

const adminUser = {
  id: 1,
  username: 'admin',
  realName: '管理员',
  role: 'admin',
  status: 'active',
};

const normalUser = {
  id: 10,
  username: 'xiaobai-sh',
  realName: '普通用户',
  role: 'user',
  status: 'active',
};

assert.equal(parseBearerToken('Bearer token-123'), 'token-123');
assert.equal(parseBearerToken('bearer token-456'), 'token-456');
assert.equal(parseBearerToken('token-789'), null);
assert.equal(parseBearerToken(undefined), null);

assert.equal(isAdminUser(adminUser), true);
assert.equal(isAdminUser(normalUser), false);
assert.equal(canAccessUser(adminUser, 88), true);
assert.equal(canAccessUser(normalUser, 10), true);
assert.equal(canAccessUser(normalUser, 11), false);

assert.deepEqual(
  normalizeBalanceAdjustment({
    type: 'increase',
    amount: '12.30',
    reason: '  仿真充值  ',
  }),
  {
    type: 'increase',
    amount: 12.3,
    reason: '仿真充值',
  },
);

assert.throws(
  () =>
    normalizeBalanceAdjustment({
      type: 'increase',
      amount: '0',
      reason: '仿真充值',
    }),
  /金额必须大于0/,
);

assert.throws(
  () =>
    normalizeBalanceAdjustment({
      type: 'decrease',
      amount: '1',
      reason: ' ',
    }),
  /操作原因不能为空/,
);

assert.throws(
  () =>
    normalizeBalanceAdjustment({
      type: 'refund',
      amount: '1',
      reason: '非法类型',
    }),
  /操作类型无效/,
);

assert.equal(
  getClientIp({
    headers: {
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  } as any),
  '203.0.113.10',
);

const runAsyncAssertions = async () => {
  const firstToken = signAccessToken({
    id: 999,
    username: 'same-second-login',
    role: 'admin',
  });
  const secondToken = signAccessToken({
    id: 999,
    username: 'same-second-login',
    role: 'admin',
  });

  assert.notEqual(firstToken, secondToken);

  const revocationTestToken = signAccessToken({
    id: Date.now(),
    username: `revocation-${Date.now()}`,
    role: 'admin',
  });

  assert.equal(hashAccessToken(revocationTestToken).length, 64);
  assert.ok(getTokenExpiresAt(revocationTestToken) instanceof Date);
  assert.equal(await revokeAccessToken('not-a-valid-token', adminUser), false);
};

runAsyncAssertions()
  .then(() => {
    console.log('server security regression tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
