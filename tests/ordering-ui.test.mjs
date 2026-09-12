import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('customer ordering implements meals, staff-first nomination, tips, dependent deletion, recovery, and order history', async () => {
  const source = await readFile(new URL('../features/ordering/components/OrderClient.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../features/ordering/api/client.js', import.meta.url), 'utf8');

  assert.match(source, /一般點餐/);
  assert.match(source, /先選店員，再查看該店員提供的服務/);
  assert.match(source, /Math\.ceil\(service\.durationMinutes \/ settings\.segmentMinutes\)/);
  assert.match(source, /service\.durationMinutes \? 1 : safeSegments/);
  assert.match(source, /基礎指名費/);
  assert.match(source, /請先刪除服務項目/);
  assert.match(source, /將此分配結果加入本次點餐/);
  assert.match(source, /店員小費比例/);
  assert.match(source, /tipPresetAmounts/);
  assert.match(source, /tipMoney/);
  assert.match(await readFile(new URL('../styles/ordering/site.css', import.meta.url), 'utf8'), /\.tipRange input\{direction:rtl\}/);
  assert.match(source, /找回並刷新點餐 UI/);
  assert.match(source, /我的訂單/);
  assert.match(source, /純陪伴/);
  assert.match(source, /附掛加購服務單/);
  assert.match(source, /在此指名時段追加服務/);
  assert.match(source, /不再收基礎指名費，也不延長原結束時間/);
  assert.match(source, /目前為協調接單/);
  assert.match(source, /等待店員接受協調單/);
  assert.match(source, /點餐碼仍可查看既有訂單/);
  assert.match(source, /businessContext\?\.intakeMode === 'staff_only'/);
  assert.match(api, /X-Order-Token/);
  assert.match(api, /\/recover/);
  assert.match(api, /submitAddon/);
});

test('customer recovery adopts the issued short order URL', async () => {
  const source = await readFile(new URL('../features/ordering/components/OrderClient.jsx', import.meta.url), 'utf8');

  assert.match(source, /new URL\(issued\.orderUrl, window\.location\.origin\)/);
  assert.match(source, /const nextToken = issuedUrl\.searchParams\.get\('code'\) \|\| issued\.orderToken/);
  assert.match(source, /window\.history\.replaceState\(null, '', `\$\{issuedUrl\.pathname\}\$\{issuedUrl\.search\}`\)/);
});

test('customer ordering hides unavailable staff and keeps the ordering UI concise', async () => {
  const source = await readFile(new URL('../features/ordering/components/OrderClient.jsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../styles/ordering/modern.css', import.meta.url), 'utf8');

  assert.match(source, /const visibleStaff = staff\.filter\(\(person\) => person\.isWorkingToday && person\.isNominatable\)/);
  assert.match(source, /visibleStaff\.map/);
  assert.match(source, /僅顯示今日上班且可指名的店員/);
  assert.match(source, /選擇指名方式\(二擇一\)/);
  assert.match(source, /指名\+加購服務/);
  assert.match(source, /<span>可折抵餘額<\/span>/);
  assert.doesNotMatch(source, /<small>\{item\.kind === 'set' \? 'SET' : 'MENU'\}<\/small>/);
  assert.doesNotMatch(source, /<p>餐點、包廂、指名服務與小費會在送出前集中顯示/);
  assert.match(styles, /\.roomBookingSection\s*\{/);
  assert.match(styles, /\.roomBookingCard\.isActive\s*\{/);
  assert.match(styles, /\.orderCredit\s*\{/);
});

test('customer ordering summary uses clear actions and keeps room duration inline', async () => {
  const source = await readFile(new URL('../features/ordering/components/OrderClient.jsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../styles/ordering/modern.css', import.meta.url), 'utf8');

  assert.match(source, /\['cart', '購物車'\]/);
  assert.match(source, /\['orders', '全部訂單'\]/);
  assert.match(source, /<dt>可折抵的餐點費用<\/dt>/);
  assert.match(source, /<button className="isSecondary"[\s\S]*查看全部訂單/);
  assert.match(source, /<button type="button"[\s\S]*購物車結帳/);
  assert.match(source, /className="stepperWithDuration"/);
  assert.match(styles, /\.stepperWithDuration\s*\{[\s\S]*display:flex/);
  assert.match(styles, /\.orderAside>button\.isSecondary\s*\{\s*margin-top:0;/);
});

test('customer ordering keeps service descriptions readable and uses the official empty-state mark', async () => {
  const source = await readFile(new URL('../features/ordering/components/OrderClient.jsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../styles/ordering/modern.css', import.meta.url), 'utf8');

  assert.match(source, /<p>\{item\.serviceDescription\}<\/p>/);
  assert.match(source, /className="orderEmptyLogo"/);
  assert.match(source, /<img src="\/favicon\.ico" alt="清醒夢" \/>/);
  assert.match(styles, /\.nominationServiceGrid\s*\{[\s\S]*grid-template-columns:1fr/);
  assert.match(styles, /\.nominationServiceGrid>button\s*\{[\s\S]*min-height:0[\s\S]*height:auto/);
  assert.match(styles, /\.nominationServiceGrid p\s*\{[\s\S]*white-space:pre-line[\s\S]*overflow-wrap:anywhere/);
  assert.match(styles, /\.orderTopbar \.orderBrand\s*\{[\s\S]*transform:scale/);
});

test('admin ordering workspace groups customers and exposes permission-gated operating settings', async () => {
  const source = await readFile(new URL('../features/admin/orders/AdminOrdersPage.jsx', import.meta.url), 'utf8');
  const routes = await readFile(new URL('../features/admin/shell/AdminRoutes.jsx', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../features/admin/layout/AdminLayout.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../features/admin/api/client.js', import.meta.url), 'utf8');

  assert.match(routes, /AdminOrdersRoute/);
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
  assert.match(source, /結束時間屬於隔日/);
  assert.match(source, /凌晨 02:00 的訂單仍歸前一個營業日/);
  assert.match(source, /確認我的指名/);
  assert.match(source, /代為確認指名服務/);
  assert.match(source, /canManageNomineeConfirmation/);
  assert.match(source, /退回重新排程/);
  assert.match(source, /重新排程（尚未接待）/);
  assert.match(source, /已接待補登/);
  assert.match(source, /補登服務中/);
  assert.match(source, /補登已完成/);
  assert.match(source, /backfillServedOrder/);
  assert.match(api, /backfillServedOrder/);
  assert.match(source, /小費按鈕 \{index \+ 1\}（Gil）/);
  assert.match(source, /狀態操作原因（取消／退回／提早完成必填）/);
  assert.match(source, /實際提早完成/);
  assert.match(source, /正式縮短為/);
  assert.match(source, /adminApi\.updateOrderItem/);
  assert.match(source, /既有指名不可修改節數/);
  assert.match(source, /代客加購服務/);
  assert.match(source, /選好並代客送單/);
  assert.match(source, /確認我的加購服務/);
  assert.match(source, /現在開店/);
  assert.match(source, /提早 30 分/);
  assert.match(source, /延後 30 分/);
  assert.match(source, /協調接單/);
  assert.match(source, /僅店員接單/);
  assert.match(source, /實際關店/);
  assert.match(source, /誤關重開/);
  assert.match(source, /完成結算/);
  assert.match(source, /接受協調單/);
  assert.match(source, /顧客離店／停止點餐/);
  assert.match(api, /confirmNominee/);
  assert.match(api, /pauseNomination/);
  assert.match(api, /reissueOrderSession/);
  assert.match(api, /getOrderingContext/);
  assert.match(api, /transitionOrder/);
  assert.match(api, /shortenNomination/);
  assert.match(api, /getAddonOptions/);
  assert.match(api, /submitAdminAddon/);
  assert.match(api, /confirmAddon/);
  assert.match(api, /openBusinessPeriod/);
  assert.match(api, /applyBusinessPeriodAction/);
  assert.match(api, /decideStoreConfirmation/);
});

test('ordering API client submits a service add-on against the parent nomination', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: { id: 'addon-order-1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const moduleUrl = new URL('../features/ordering/api/client.js', import.meta.url);
    moduleUrl.searchParams.set('addon-test', `${process.pid}-${Date.now()}`);
    const { orderingApi } = await import(moduleUrl.href);
    await orderingApi.submitAddon('secure-token', {
      parentNomineeId: 'nominee-1', serviceId: 'drawing-1', segmentCount: 2, participantCount: 1,
    });
    assert.equal(calls[0].url, '/api/ordering/addons');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['X-Order-Token'], 'secure-token');
    assert.equal(JSON.parse(calls[0].options.body).parentNomineeId, 'nominee-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
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
    const moduleUrl = new URL('../features/ordering/api/client.js', import.meta.url);
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
