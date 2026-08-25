import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('staff avatar editor keeps separate upload, crop, and delete actions', async () => {
  const source = await readFile(new URL('../app/admin/_components/AdminAvatarPicker.jsx', import.meta.url), 'utf8');
  const proxy = await readFile(new URL('../app/api/admin-media/[id]/route.ts', import.meta.url), 'utf8');

  assert.match(source, /上傳圖片/);
  assert.match(source, /調整圖片/);
  assert.match(source, />刪除</);
  assert.match(source, /react-easy-crop/);
  assert.match(source, /browser-image-compression/);
  assert.match(source, /\/api\/admin-media\//);
  assert.match(proxy, /variant=original/);
  assert.match(source, /const AVATAR_WIDTH = 1200/);
  assert.match(source, /const AVATAR_HEIGHT = 1500/);
});

test('staff ordering settings expose buffer, nomination, and structured service prices', async () => {
  const source = await readFile(new URL('../app/admin/_components/AdminStaffSettingsPage.jsx', import.meta.url), 'utf8');
  const archive = await readFile(new URL('../app/StaffArchive.tsx', import.meta.url), 'utf8');

  assert.match(source, /label="中間休息時間"><input type="number"/);
  assert.match(source, /label="開放指名"/);
  assert.match(source, /中間休息 \$\{item\.bufferMinutes\} 分鐘/);
  assert.match(source, /label="價格"><input type="number"/);
  assert.match(source, /label="時間"><input type="number"/);
  assert.match(source, /label="每位額外人數價格"><input type="number"/);
  assert.match(source, /label="可指名"/);
  assert.match(source, /isNominatable/);
  assert.match(source, /durationMinutes/);
  assert.match(source, /additionalPersonPrice/);
  assert.match(archive, /person\.isNominatable === true/);
  assert.doesNotMatch(archive, /Temporary availability override/);
});

test('the detached public action returns to the top on desktop and mobile', async () => {
  const source = await readFile(new URL('../app/SiteChrome.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /aria-label="回到頁面頂端"/);
  assert.match(source, />TOP<\/b>/);
  assert.match(source, /window\.scrollTo\(\{top:0/);
  assert.match(styles, /\.site-floating-top/);
  assert.doesNotMatch(styles, /\.site-floating-menu/);
});
