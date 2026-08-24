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
