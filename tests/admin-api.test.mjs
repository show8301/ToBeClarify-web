import assert from 'node:assert/strict';
import test from 'node:test';

test('staff status changes use the dedicated immediate-save endpoint', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      success: true,
      data: { id: 'staff/with space', isWorkingToday: false, isActive: true },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const moduleUrl = new URL('../app/admin/admin-api.js', import.meta.url);
    moduleUrl.searchParams.set('test', `${process.pid}-${Date.now()}`);
    const { adminApi } = await import(moduleUrl.href);
    const result = await adminApi.updateStaffMemberStatus('staff/with space', { isWorkingToday: false });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/admin/staff-members/staff%2Fwith%20space/status');
    assert.equal(calls[0].options.method, 'PUT');
    assert.deepEqual(JSON.parse(calls[0].options.body), { isWorkingToday: false });
    assert.equal(result.isWorkingToday, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin proxy accepts same-origin mutations behind a trusted reverse proxy', async () => {
  const moduleUrl = new URL('../app/api/admin/[...path]/route.ts', import.meta.url);
  moduleUrl.searchParams.set('test', `${process.pid}-${Date.now()}`);
  const { isSameOriginRequest } = await import(moduleUrl.href);

  const proxiedRequest = new Request('http://internal-service:3000/api/admin/auth/login', {
    method: 'POST',
    headers: {
      origin: 'https://lucid.zeabur.app',
      host: 'internal-service:3000',
      'x-forwarded-host': 'lucid.zeabur.app',
      'x-forwarded-proto': 'https',
    },
  });
  const crossSiteRequest = new Request('http://internal-service:3000/api/admin/auth/login', {
    method: 'POST',
    headers: {
      origin: 'https://attacker.example',
      host: 'internal-service:3000',
      'x-forwarded-host': 'lucid.zeabur.app',
    },
  });

  assert.equal(isSameOriginRequest(proxiedRequest), true);
  assert.equal(isSameOriginRequest(crossSiteRequest), false);
});

test('admin proxy preserves bodyless 204 responses instead of converting them to 502', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });

  try {
    const moduleUrl = new URL('../app/api/admin/[...path]/route.ts', import.meta.url);
    moduleUrl.searchParams.set('test', `${process.pid}-${Date.now()}-204`);
    const { POST } = await import(moduleUrl.href);
    const request = new Request('http://internal-service:3000/api/admin/auth/forgot-password/reset', {
      method: 'POST',
      headers: {
        origin: 'https://lucid.zeabur.app',
        host: 'internal-service:3000',
        'x-forwarded-host': 'lucid.zeabur.app',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ loginName: 'clerk-demo' }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ['auth', 'forgot-password', 'reset'] }),
    });

    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.has('content-type'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('password reset API methods use the admin auth endpoints', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/password-reset-key')) {
      return new Response(JSON.stringify({
        success: true,
        data: { key: 'reset-key', expiresAt: '2026-08-28T12:00:00Z' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(null, { status: 204 });
  };

  try {
    const moduleUrl = new URL('../app/admin/admin-api.js', import.meta.url);
    moduleUrl.searchParams.set('test', `${process.pid}-${Date.now()}`);
    const { adminApi } = await import(moduleUrl.href);
    const key = await adminApi.getPasswordResetKey({ loginName: 'clerk-demo' });
    await adminApi.resetPassword({ loginName: 'clerk-demo', newPassword: 'new-password', verificationCode: 'reset-key' });

    assert.deepEqual(key, { key: 'reset-key', expiresAt: '2026-08-28T12:00:00Z' });
    assert.equal(calls[0].url, '/api/admin/auth/password-reset-key');
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), { loginName: 'clerk-demo' });
    assert.equal(calls[1].url, '/api/admin/auth/forgot-password/reset');
    assert.equal(calls[1].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].options.body), { loginName: 'clerk-demo', newPassword: 'new-password', verificationCode: 'reset-key' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('all staff list uses the dedicated developer endpoint', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      success: true,
      data: [{ displayName: '測試店員', loginName: 'tester', id: 'staff-1' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const moduleUrl = new URL('../app/admin/admin-api.js', import.meta.url);
    moduleUrl.searchParams.set('test', `${process.pid}-${Date.now()}-all-staff-list`);
    const { adminApi } = await import(moduleUrl.href);
    const result = await adminApi.getAllStaffList();

    assert.deepEqual(result, [{ displayName: '測試店員', loginName: 'tester', id: 'staff-1' }]);
    assert.equal(calls[0].url, '/api/admin/all-staff-list');
    assert.equal(calls[0].options.method, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
