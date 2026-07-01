---
name: Main Style Skill
description: 用於開發 FF14 RP店 網頁前端所使用的，設計相關的技能檔
user-invocable: true
---

# FF14 RP 指名類酒店網站開發 Skill

## 使用目標

這份 skill 用於協助 Codex 開發一個 FF14 RP 店鋪網站。網站定位是「指名類酒店／陪伴型 RP 店」，需要同時支援客戶端展示頁面與後台維護端作業。

請把這份文件視為專案規格與開發約束。實作時要優先保持可維護、可擴充、資料結構清楚、畫面風格一致。若需求不完整，請先用合理預設完成可運作版本，並在程式註解或 TODO 中標示可調整處。

## 專案定位

網站服務對象分為兩種：

- 客戶：查看店鋪資訊、活動預告、店員資料、消費規則、排行榜、花絮照片與上班班表。
- 工作人員／管理者：打卡、管理包廂、建立訂單、查詢訂單紀錄、設定班表、維護工作人員資料、計算薪水。

整體語氣要符合 FF14 RP 店鋪氛圍，避免過度現代商業網站感。文字可以帶有酒館、夜店、沙龍、貴賓廳、指名陪伴等意象，但不要寫成成人服務或現實違規內容。

## 建議技術方向

若專案沒有指定技術棧，建議使用：

- 前端 Vite + React
- 樣式：CSS Modules / Tailwind CSS / 原生 CSS 皆可，但要集中設計 token
- 後端：C# API
- 資料庫：MySql
- 圖片：public assets
- 驗證：後台登入使用 session cookie 或 JWT，密碼必須 hash，不可明文存放

如果是純前端 prototype，可以先用 JSON mock data，但資料結構要接近正式 API。

## 重要開發原則

- 客戶端與後台維護端需明確分離，建議路由分為 `/` 與 `/admin`。
- 客戶端可公開讀取資料，後台 API 必須驗證身分。
- 所有金額、指名次數、薪水計算都要以資料庫紀錄為準，不可只存在前端狀態。
- 時間欄位統一使用 ISO 8601 或資料庫 datetime，顯示時再轉換為台灣時間。
- 排行榜資料要能依日期區間篩選，例如本週、本月、活動期間、全部。
- 訂單、打卡、薪資計算都要保留可追溯資料，避免覆蓋歷史紀錄。
- 後台操作需有清楚的 loading、success、error 狀態。
- RWD 必須支援手機、平板、桌面。

## 視覺風格方向

延續沉浸式暗黑風格，但主題從音樂節改為 FF14 RP 指名酒店。

風格關鍵字：

- 深夜沙龍
- 高級酒館
- 暗色貴賓廳
- 燭光、霓虹、金屬飾邊
- 低光電影感
- 神秘、優雅、可讀性高

不要使用純黑背景，也不要整頁霓虹過量。暗色層次應以多層背景與細邊框建立深度。

### Design Tokens

```css
:root {
  --color-bg-0: #0a0a0f;
  --color-bg-1: #15151c;
  --color-bg-2: #1f1f29;
  --color-bg-3: #2a2a36;

  --color-fg: #f5f5f7;
  --color-fg-soft: #b8b8c2;
  --color-fg-mute: #6e6e7a;

  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.16);

  --color-accent: #ff2e88;
  --color-accent-glow: rgba(214, 180, 106, 0.42);
  --color-accent-2: #06d6a0;
  --color-danger: #ff6b6b;
  --color-success: #8bd48b;

  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-pill: 999px;

  --shadow-card: 0 16px 48px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 32px var(--color-accent-glow);

  --font-display: 'Noto Serif TC', 'PingFang TC', 'Noto Sans TC', serif;
  --font-body: 'PingFang TC', 'Noto Sans TC', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Menlo', monospace;
}
```

### Typography

| 級距 | 建議值 | 用途 |
| --- | --- | --- |
| display | clamp(44px, 7vw, 84px) / 1.05 / 700 | 首頁 Hero、店名 |
| h1 | clamp(28px, 4vw, 40px) / 1.2 / 600 | 頁面標題 |
| h2 | 22px / 1.35 / 600 | 卡片標題、區塊標題 |
| body | 15px / 1.7 / 400 | 一般內文 |
| caption | 12px / 1.5 / 500 / 0.08em | 標籤、狀態、分類 |
| mono | 13px / 1.5 / 500 | 時間、金額、數字 |

## 客戶端頁面通用設定

### 動畫

第一次進入網頁時，要有loading動畫，同意另外使用動畫套件。
圖片輪播、前往不同分頁等轉換呈現內容操作時，都要有適當的動畫。


### 導覽列 navbar

目的：要將首頁、店員珍藏（店員介紹）、慶典情報（活動資訊）、艾歐澤亞週報（活動花絮）、留聲機（留言板）、店舖動態、榮譽殿堂顯示於navbar


## 後台維護端頁面

後台路由建議放在 `/admin` 底下。所有後台頁面都需要登入驗證。

### 後台首頁 `/admin`

建議顯示：

- 今日營業狀態
- 今日上班人員
- 今日包廂使用狀態
- 今日訂單數與營收摘要
- 未結帳訂單
- 快捷入口：打卡、下單、班表、薪水計算

### 打卡 `/admin/clock`

目的：記錄工作人員上下班時間。

必要功能：

- 上班打卡
- 下班打卡
- 顯示當前打卡狀態
- 顯示今日打卡紀錄
- 管理者可補登或修正

資料欄位建議：

- staff_id
- clock_in_at
- clock_out_at
- status
- note
- adjusted_by
- adjusted_reason

### 包廂 `/admin/rooms`

目的：管理包廂、座位或接待空間狀態。

必要功能：

- 包廂列表
- 狀態：空房、使用中、清潔中、保留中、停用
- 指派客人或訂單
- 開房時間、結束時間
- 備註

注意事項：

- 包廂狀態應與訂單連動，但仍允許管理者手動調整。
- 需要避免同一時間同一包廂被重複開單。

### 訂單紀錄 `/admin/orders`

目的：查詢與稽核歷史訂單。

必要功能：

- 訂單列表
- 日期區間篩選
- 店員篩選
- 客人篩選
- 訂單狀態篩選：未結帳、已結帳、取消、作廢
- 訂單詳情
- 匯出 CSV，可後續擴充

必要欄位：

- order_no
- guest_name
- room_id
- staff_id
- total_amount
- status
- created_at
- paid_at
- created_by

### 下單系統 `/admin/order-entry`

目的：營業中快速建立訂單。

必要功能：

- 選擇客人
- 選擇包廂或座位
- 選擇指名店員
- 加入商品或服務項目
- 調整數量與備註
- 自動計算小計、折扣、總額
- 結帳或暫存

建議商品類型：

- 入場費
- 包廂費
- 指名費
- 飲品
- 餐點
- 活動項目
- 其他自訂項目

注意事項：

- 訂單成立後不要直接覆蓋明細，修改需保留紀錄或以狀態註記。
- 金額計算應由後端再次驗算，不能只相信前端。

### 班表設定 `/admin/schedule`

目的：維護店員出勤資料並供前台顯示。

必要功能：

- 新增班表
- 編輯班表
- 刪除或停用班表
- 批次建立一週班表
- 設定是否前台公開
- 設定是否可指名

必要欄位：

- staff_id
- work_date
- start_time
- end_time
- role_on_shift
- is_public
- is_bookable
- note

### 工作人員設定 `/admin/staff`

目的：維護店員與管理者資料。

必要功能：

- 新增／編輯／停用工作人員
- 設定登入帳號
- 設定角色權限
- 上傳或選擇角色照片
- 設定前台顯示資料
- 設定薪資規則

建議權限：

- owner：最高權限
- manager：管理班表、訂單、薪資
- staff：只能查看自己資料、打卡、查看相關訂單
- viewer：唯讀

### 薪水計算 `/admin/payroll`

目的：依打卡、班表、訂單與抽成規則計算薪水。

必要功能：

- 選擇薪資期間
- 選擇工作人員
- 計算工時
- 計算基本時薪
- 計算指名抽成
- 計算銷售抽成
- 加扣項目
- 產生薪資明細
- 鎖定已確認薪資

薪資計算建議公式：

```text
總薪資 = 基本工時薪資 + 指名抽成 + 銷售抽成 + 獎金 - 扣款
```

注意事項：

- 薪資明細確認後應鎖定，不可因歷史訂單異動而自動改變。
- 若需要重算，建立新的 payroll run 或保留修正紀錄。
- 前台 API 絕不可暴露薪資資料。

## 建議資料模型

以下為通用資料模型，可依實際 DB 語法調整。

### users

後台登入帳號。

- id
- username
- password_hash
- role
- staff_id
- is_active
- created_at
- updated_at

### staff

工作人員與前台店員資料。

- id
- display_name
- character_name
- avatar_url
- cover_image_url
- race
- position
- intro
- rp_style
- services
- nomination_fee
- is_public
- is_active
- sort_order
- created_at
- updated_at

### guests

客人資料。注意隱私，前台顯示需使用 nickname 或 anonymous_name。

- id
- nickname
- public_name
- discord_name
- is_ranking_public
- note
- created_at
- updated_at

### events

活動預告。

- id
- title
- description
- image_url
- start_at
- end_at
- status
- is_public
- created_at
- updated_at

### event_staff

活動與店員關聯。

- event_id
- staff_id

### schedules

上班班表。

- id
- staff_id
- work_date
- start_time
- end_time
- role_on_shift
- is_public
- is_bookable
- status
- note
- created_at
- updated_at

### clock_records

打卡紀錄。

- id
- staff_id
- clock_in_at
- clock_out_at
- status
- note
- adjusted_by
- adjusted_reason
- created_at
- updated_at

### rooms

包廂或座位。

- id
- name
- type
- capacity
- status
- sort_order
- is_active
- created_at
- updated_at

### menu_items

商品或服務項目。

- id
- name
- category
- price
- commission_type
- commission_value
- is_active
- sort_order
- created_at
- updated_at

### orders

訂單主檔。

- id
- order_no
- guest_id
- guest_name_snapshot
- room_id
- primary_staff_id
- status
- subtotal_amount
- discount_amount
- total_amount
- note
- created_by
- paid_at
- voided_at
- created_at
- updated_at

### order_items

訂單明細。

- id
- order_id
- item_id
- item_name_snapshot
- staff_id
- quantity
- unit_price
- subtotal_amount
- commission_amount
- note
- created_at
- updated_at

### rankings

若排行需要快取，可使用此表。也可由 orders 即時計算。

- id
- ranking_type
- target_type
- target_id
- period_start
- period_end
- score
- amount
- rank_no
- generated_at

### gallery_photos

花絮照片。

- id
- title
- image_url
- category
- description
- taken_at
- is_public
- approval_status
- sort_order
- created_at
- updated_at

### payroll_runs

薪資批次。

- id
- period_start
- period_end
- status
- generated_by
- generated_at
- locked_at

### payroll_items

薪資明細。

- id
- payroll_run_id
- staff_id
- base_hours
- base_pay
- nomination_commission
- sales_commission
- bonus_amount
- deduction_amount
- total_pay
- note
- created_at

## 建議 API 設計

### Public API

- `GET /api/public/home`
- `GET /api/public/events`
- `GET /api/public/staff`
- `GET /api/public/pricing`
- `GET /api/public/staff-ranking?period=this_month`
- `GET /api/public/guest-ranking?period=this_month`
- `GET /api/public/gallery`
- `GET /api/public/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD`

Public API 不可回傳：

- password_hash
- 薪資資料
- 內部營收欄位
- 客人 Discord ID
- 後台備註
- 不公開或停用的資料

### Admin API

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/me`
- `GET /api/admin/dashboard`
- `POST /api/admin/clock/in`
- `POST /api/admin/clock/out`
- `GET /api/admin/rooms`
- `PATCH /api/admin/rooms/:id`
- `GET /api/admin/orders`
- `POST /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id`
- `POST /api/admin/orders/:id/pay`
- `POST /api/admin/orders/:id/void`
- `GET /api/admin/schedules`
- `POST /api/admin/schedules`
- `PATCH /api/admin/schedules/:id`
- `GET /api/admin/staff`
- `POST /api/admin/staff`
- `PATCH /api/admin/staff/:id`
- `POST /api/admin/payroll/calculate`
- `POST /api/admin/payroll/lock`

## UI 元件要求

請優先建立可重用元件：

- `PublicLayout`
- `AdminLayout`
- `PageHeader`
- `SectionTitle`
- `DarkCard`
- `StatusBadge`
- `StaffCard`
- `RankingCard`
- `ScheduleCalendar`
- `DataTable`
- `Modal`
- `ConfirmDialog`
- `FormField`
- `MoneyText`
- `EmptyState`
- `LoadingState`
- `ErrorState`

## 表單與驗證規則

- 必填欄位要有明確錯誤訊息。
- 金額不可為負數。
- 數量至少為 1。
- 班表結束時間必須晚於開始時間。
- 打卡不可重複上班打卡。
- 已結帳訂單不可任意修改金額，需走作廢或調整流程。
- 薪資鎖定後不可修改，需建立修正紀錄。

## 實作順序建議

請依照以下順序開發，降低返工：

1. 建立專案結構與共用 layout
2. 建立 design tokens 與暗色 UI 基礎元件
3. 建立 mock data 與型別定義
4. 完成客戶端頁面靜態版
5. 建立資料庫 schema 與 seed data
6. 完成 public API
7. 將客戶端從 mock data 改接 public API
8. 建立後台登入與權限
9. 完成後台 dashboard
10. 完成工作人員設定與班表設定
11. 完成打卡與包廂管理
12. 完成下單系統與訂單紀錄
13. 完成排行榜計算
14. 完成薪水計算
15. 補齊錯誤處理、RWD、空狀態、loading 狀態
16. 補測試與 README

## Codex 執行規則

當 Codex 依照此 skill 實作時，請遵守：

- 不要一次重寫整個專案，優先小步提交。
- 修改前先理解現有架構與命名風格。
- 若專案已有既定框架，沿用現有框架，不要任意換技術棧。
- 新增資料表或 API 時，同步更新型別、mock data、文件。
- 不要把範例帳號密碼、API key、token 寫死在程式碼中。
- 不要在前台暴露後台 API 或敏感欄位。
- 每次完成一個功能後，確認 build / lint / typecheck 是否通過。
- 若無法執行測試，請明確列出未執行原因與建議測試方式。

## 驗收條件

客戶端驗收：

- 首頁、活動預告、店員介紹、消費說明、店員榜、客人榜、花絮照片、上班班表都可正常瀏覽。
- 手機版與桌面版皆可讀、可操作。
- 排行榜與班表可依資料變動更新。
- 圖片有 lazy loading 與基本 fallback。
- 不公開資料不會出現在前台。

後台驗收：

- 管理者可登入與登出。
- 可新增、編輯、停用工作人員。
- 可設定班表並同步顯示到前台。
- 可打卡與查看打卡紀錄。
- 可管理包廂狀態。
- 可建立訂單、加入明細、結帳、查詢紀錄。
- 可依期間計算薪資並產生明細。
- 權限不足者不可操作管理功能。

資料驗收：

- 訂單總額與明細小計一致。
- 排行榜統計來源清楚。
- 薪水計算結果可追溯到打卡、訂單與薪資規則。
- 刪除或停用資料不會破壞歷史訂單。

## 可調整區域

後續若店鋪設定更明確，可優先調整：

- 店名與品牌色
- 指名費與消費規則
- 店員欄位
- 排行榜統計口徑
- 薪資計算公式
- 權限角色
- 圖片儲存方式
- 部署平台

## Reference CSS Snippets

暗卡：

```css
.card {
  background: var(--color-bg-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 24px;
}

.cardElevated {
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-card);
}
```

狀態標籤：

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 4px 10px;
  color: var(--color-fg-soft);
  background: rgba(255, 255, 255, 0.04);
  font-size: 12px;
}

.badgeAvailable {
  color: var(--color-success);
  border-color: rgba(139, 212, 139, 0.35);
}

.badgeBusy {
  color: var(--color-accent);
  border-color: rgba(214, 180, 106, 0.35);
}
```

Hero overlay：

```css
.hero {
  position: relative;
  overflow: hidden;
  min-height: 72vh;
  background: var(--color-bg-0);
}

.heroImage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.52;
  filter: saturate(0.82) contrast(1.08);
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 70% 25%, rgba(214, 180, 106, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(10, 10, 15, 0.18) 0%, var(--color-bg-0) 86%);
}
```

主要按鈕：

```css
.btnPrimary {
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-pill);
  padding: 12px 22px;
  background: var(--color-accent);
  color: var(--color-bg-0);
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow: 0 0 24px var(--color-accent-glow);
}

.btnSecondary {
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  padding: 12px 22px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-fg);
}
```
