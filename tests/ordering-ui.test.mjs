import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('customer ordering implements meals, staff-first nomination, tips, dependent deletion, recovery, and order history', async () => {
  const source = await readFile(new URL('../app/order/OrderClient.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../app/order/ordering-api.js', import.meta.url), 'utf8');

  assert.match(source, /一般點餐/);
  assert.match(source, /先選店員，再查看該店員提供的服務/);
  assert.match(source, /Math\.ceil\(service\.durationMinutes \/ settings\.segmentMinutes\)/);
  assert.match(source, /service\.durationMinutes \? 1 : safeSegments/);
  assert.match(source, /基礎指名費/);
  assert.match(source, /請先刪除服務項目/);
  assert.match(source, /將此分配結果加入本次點餐/);
  assert.match(source, /店員小費比例/);
  assert.match(source, /找回並刷新點餐 UI/);
  assert.match(source, /我的訂單/);
  assert.match(api, /X-Order-Token/);
  assert.match(api, /\/recover/);
});

test('admin ordering workspace groups customers and exposes permission-gated operating settings', async () => {
  const source = await readFile(new URL('../app/admin/_components/AdminOrdersPage.jsx', import.meta.url), 'utf8');
  const router = await readFile(new URL('../app/admin/_components/AdminRouter.jsx', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../app/admin/_components/AdminLayout.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../app/admin/admin-api.js', import.meta.url), 'utf8');

  assert.match(router, /\/admin\/orders/);
  assert.match(layout, /點單管理/);
  assert.match(source, /待處理/);
  assert.match(source, /其他顧客/);
  assert.match(source, /搜尋顧客名稱或遊戲 ID/);
  assert.match(source, /user\.role === 'developer' \|\| user\.role === 'manager'/);
  assert.match(source, /低消／信物可折抵金額/);
  assert.match(source, /每節基礎指名費/);
  assert.match(source, /提醒（分鐘）/);
  assert.match(source, /升級（分鐘）/);
  assert.match(source, /失效（分鐘）/);
  assert.match(source, /確認我的指名/);
  assert.match(api, /confirmNominee/);
  assert.match(api, /pauseNomination/);
  assert.match(api, /reissueOrderSession/);
});

test('ordering API client sends cart snapshots to the customer endpoint', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: { id: 'order-1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const moduleUrl = new URL('../app/order/ordering-api.js', import.meta.url);
    moduleUrl.searchParams.set('test', `${process.pid}-${Date.now()}`);
    const { orderingApi } = await import(moduleUrl.href);
    await orderingApi.submit('secure-token', { meals: [{ referenceId: 'meal-1', kind: 'item', quantity: 2 }] });
    assert.equal(calls[0].url, '/api/ordering/orders');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['X-Order-Token'], 'secure-token');
    assert.deepEqual(JSON.parse(calls[0].options.body).meals[0], { referenceId: 'meal-1', kind: 'item', quantity: 2 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
