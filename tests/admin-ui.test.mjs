import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('staff avatar editor keeps separate upload, crop, and delete actions', async () => {
  const source = await readFile(new URL('../app/admin/_components/AdminAvatarPicker.jsx', import.meta.url), 'utf8');
  const processor = await readFile(new URL('../app/admin/_components/AdminImageProcessingProvider.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../app/admin/AdminClient.tsx', import.meta.url), 'utf8');
  const shared = await readFile(new URL('../app/admin/_components/AdminShared.jsx', import.meta.url), 'utf8');
  const imageProcessing = await readFile(new URL('../app/admin/_components/adminImageProcessing.js', import.meta.url), 'utf8');
  const proxy = await readFile(new URL('../app/api/admin-media/[id]/route.ts', import.meta.url), 'utf8');

  assert.match(source, /上傳圖片/);
  assert.match(source, /調整圖片/);
  assert.match(source, />刪除</);
  assert.match(processor, /react-easy-crop/);
  assert.match(imageProcessing, /browser-image-compression/);
  assert.match(source, /\/api\/admin-media\//);
  assert.match(proxy, /variant=original/);
  assert.match(source, /const AVATAR_WIDTH = 1200/);
  assert.match(source, /const AVATAR_HEIGHT = 1500/);
  assert.match(source, /cropOnUpload = true/);
  assert.match(imageProcessing, /fileType: 'image\/webp'/);
  assert.match(imageProcessing, /canvas\.width = options\.width/);
  assert.match(imageProcessing, /canvas\.height = options\.height/);
  assert.match(processor, /crop: shouldCrop = false/);
  assert.match(client, /<AdminImageProcessingProvider>/);
  assert.match(source, /useAdminImageProcessing/);
  assert.match(shared, /processImage\(\{ file, crop: false \}\)/);
});

test('homepage slides expose an editable playback duration', async () => {
  const source = await readFile(new URL('../app/admin/_components/AdminHomeSettingsPage.jsx', import.meta.url), 'utf8');
  const landing = await readFile(new URL('../app/HomeLanding.tsx', import.meta.url), 'utf8');

  assert.match(source, /label="播放秒數"><input type="number"/);
  assert.match(source, /displaySeconds: Math\.min\(60, Math\.max\(1/);
  assert.match(source, /播放 \{Number\(item\.displaySeconds\) \|\| 10\} 秒/);
  assert.match(landing, /const seconds=Math\.min\(60,Math\.max\(1,Number\(current\?\.displaySeconds\)\|\|10\)\)/);
});

test('developer can control each public menu page from the admin home', async () => {
  const dashboard = await readFile(new URL('../app/admin/_components/AdminHomePage.jsx', import.meta.url), 'utf8');
  const data = await readFile(new URL('../app/site-data.ts', import.meta.url), 'utf8');
  const chrome = await readFile(new URL('../app/SiteChrome.tsx', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../app/menu/page.tsx', import.meta.url), 'utf8');

  assert.match(dashboard, /user\.role === 'developer'/);
  assert.match(dashboard, /siteVisibility/);
  assert.match(dashboard, /PUBLIC_PAGES/);
  assert.match(dashboard, /number: '00'/);
  assert.match(dashboard, /number: '07'/);
  assert.match(dashboard, /label=\{visibility\.pages\[page\.key\] \? '顯示' : '隱藏'\}/);
  assert.doesNotMatch(dashboard, /label="隱藏 MENU 功能"/);
  assert.match(data, /pageVisibility/);
  assert.match(chrome, /pageVisibility/);
  assert.match(chrome, /pageNumbers/);
  assert.match(menu, /if\(!home\.pageVisibility\.menu\)notFound\(\)/);
});

test('staff ordering settings expose buffer, staff nomination, and public service prices', async () => {
  const source = await readFile(new URL('../app/admin/_components/AdminStaffSettingsPage.jsx', import.meta.url), 'utf8');
  const archive = await readFile(new URL('../app/StaffArchive.tsx', import.meta.url), 'utf8');
  const profile = await readFile(new URL('../app/StaffProfile.tsx', import.meta.url), 'utf8');

  assert.match(source, /label="中間休息時間"><input type="number"/);
  assert.match(source, /label="開放指名"/);
  assert.match(source, /中間休息 \{item\.bufferMinutes\} 分鐘/);
  assert.match(source, /label="價格"><input type="number"/);
  assert.match(source, /label="價格文字（選填）"/);
  assert.match(source, /優先取代數值價格顯示/);
  assert.match(source, /label="時間"><input type="number"/);
  assert.match(source, /label="每位額外人數價格"><input type="number"/);
  assert.doesNotMatch(source, /label="可指名"/);
  assert.match(source, /isNominatable/);
  assert.match(source, /durationMinutes/);
  assert.match(source, /additionalPersonPrice/);
  assert.match(archive, /person\.isNominatable === true/);
  assert.match(profile, /service\.priceText\?\.trim\(\)/);
  assert.match(profile, /每位額外 \+\$\{gil\(service\.additionalPersonPrice\)\}/);
  assert.doesNotMatch(archive, /Temporary availability override/);
});

test('staff detail falls back to the live API when a character is absent from the snapshot', async () => {
  const source = await readFile(new URL('../app/staff-data.ts', import.meta.url), 'utf8');
  const page = await readFile(new URL('../app/staff/[id]/page.tsx', import.meta.url), 'utf8');
  const route = await readFile(new URL('../app/api/staff/[id]/route.ts', import.meta.url), 'utf8');

  assert.match(source, /export async function getStaffDetail/);
  assert.match(source, /snapshot\.details\[id\] \?\? null/);
  assert.match(source, /await request<\{data:StaffDetail\|null\}>/);
  assert.match(source, /error\.status === 404/);
  assert.match(page, /await getStaffDetail\(id\)/);
  assert.match(page, /if\(!staff\)notFound\(\)/);
  assert.match(route, /await getStaffDetail\(id\)/);
});

test('the detached public action returns to the top on desktop and mobile', async () => {
  const source = await readFile(new URL('../app/SiteChrome.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /aria-label="回到頁面頂端"/);
  assert.match(source, />TOP<\/b>/);
  assert.match(source, /window\.scrollTo\(\{top:0/);
  assert.match(styles, /\.site-floating-top/);
  assert.match(styles, /position:fixed;z-index:82;top:auto;right:[^;]+;bottom:/);
  assert.match(styles, /\.site-floating-top b\{[^}]*font:900/);
  assert.match(styles, /\.site-floating-top span\{[^}]*display:inline-flex;align-items:center/);
  assert.doesNotMatch(styles, /\.site-floating-menu/);
});

test('the LD signature opens admin login only after five clicks', async () => {
  const source = await readFile(new URL('../app/HomeLanding.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /adminTriggerClicks\.current\+=1/);
  assert.match(source, /adminTriggerClicks\.current<5/);
  assert.match(source, /window\.location\.assign\("\/admin\/login"\)/);
  assert.match(source, /className="home-admin-trigger"[^>]+>LD<\/a> · 2026/);
  assert.match(styles, /\.home-admin-trigger\{[^}]*text-decoration:none/);
});
