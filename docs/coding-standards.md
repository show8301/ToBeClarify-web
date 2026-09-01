# ToBeClarify Web 程式撰寫規範

本規範適用於 `ToBeClarify-web`。內容以 2026-09-01 `main` 重構後的架構為基準，目的是維持清楚的責任邊界、可預期的資料流與可回復的部署方式。

規範中的「必須」表示應遵守的專案規則；「應」表示預設做法；「可以」表示在有明確理由時可採用的例外。

## 1. 語言與匯入

- 新增程式碼統一使用 TypeScript 或 TSX，不再新增 `.js` 或 `.jsx`。
- 既有 JavaScript/JSX 不要求一次性全面轉換；檔案被實質修改時，應一併轉換為 TypeScript/TSX。
- 新增型別應明確定義，不以 `any` 取代資料契約。
- 優先使用 `@/` path alias，避免跨層級的相對路徑。
- `strict` TypeScript 設定視為既定基準；型別問題應修正，不以放寬設定繞過。

## 2. 目錄責任

| 目錄 | 責任 | 不應放置 |
| --- | --- | --- |
| `app/` | App Router 頁面、layout、metadata 與 API route 入口 | 大型頁面 UI、domain state、可重用商業功能 |
| `features/` | 依產品 domain 管理 UI、API client、server data、型別與功能邏輯 | 與 domain 無關的全域元件 |
| `components/` | 跨 domain 共用的展示與互動 primitive | 特定 domain 的頁面或商業流程 |
| `lib/server/` | 僅伺服器使用的設定與基礎工具 | Client component 可引用的程式碼 |
| `data/snapshots/` | 公開資料的容錯快照 | 需要即時一致性的交易狀態 |
| `styles/` | Public、Admin、Ordering 各自的樣式入口與 layers | 任意散落的全域樣式 |
| `scripts/`、`deploy/` | 快照、建置、部署與維運腳本 | 瀏覽器執行的產品功能 |
| `tests/` | 建置、UI、API client 與部署契約測試 | 產品執行期的 workaround |

新增功能前，必須先判斷所屬 domain，再放入對應的 `features/<domain>/`。

## 3. 依賴方向

採用「禁止跨 domain 依賴實作，允許型別契約依賴」的規則。

### 允許的方向

```text
app route
  → feature entry / feature server data / shared components

feature
  → components
  → lib
  → 明確的 shared type contract
```

### 禁止的方向

- `features/A` 不得直接引用 `features/B` 的 component、server data、API client、內部 state 或 CSS。
- Feature code 不得 import `app/` 內的 implementation。
- 不得把某個 domain 的 component 放入 `components/`，再以共用名義讓其他 domain 依賴。
- 不得讓一個 domain 的 server data 成為另一個 domain 的資料層。

### 型別與共用邏輯

- 跨 domain 只需要資料形狀時，可以 type-only import 明確的 contract/type module，例如 `features/site/types.ts` 或 `features/staff/types.ts`。
- 型別檔案不可順帶輸出 runtime logic、API client 或 UI component。
- 兩個 domain 需要共用 UI 時，抽到 `components/`。
- 兩個 domain 需要共用基礎工具時，抽到 `lib/`。
- 兩個 domain 需要共用商業邏輯時，建立明確的 shared domain module，不要寄生在其中一個 domain。
- `features/admin/` 視為同一個 bounded context；其 auth、dashboard、media、orders、staff、shared 等子模組可以依賴同一後台內的共用模組，但仍不可形成循環依賴。

## 4. Route 與頁面組合

### Public route

`app/**/page.tsx` 應保持薄層，只負責：

1. 取得該頁需要的 server data。
2. 定義 metadata。
3. 執行 route-level 的 visibility、參數與 `notFound()` 判斷。
4. 將資料傳入對應的 feature component。

大型 JSX、互動 state、資料 mutation 與商業流程必須放在 feature 內。

### Admin route

- App Router 是唯一的 route table。
- `app/admin/**/page.tsx` 只選擇 `features/admin/shell/AdminRoutes.jsx` 匯出的 route entry。
- `AdminProviders` 在 admin layout 統一提供 auth、toast、image processing 與 theme context。
- `AdminRoutes` 統一處理登入狀態、loading、error 與角色權限。
- `AdminRoutes` 不以 pathname switch 取代 App Router，也不在每個頁面重複實作權限判斷。

## 5. Server data 與 API

### Server data

- Server data access 放在所屬 feature，例如 `features/site/server/`、`features/staff/server/`。
- 外部 API origin 必須由 `lib/server/upstream-config.ts` 統一管理。
- API origin 可由環境變數覆寫，程式碼必須提供合理的 default。
- Snapshot、TTL、timeout、背景刷新與 fallback 的具體數值屬於目前實作策略，不是固定規範。
- 但每個外部 server request 都必須明確處理 timeout，以及 API 失效時的 fallback 或錯誤行為。

### Browser API client

- Browser code 不得直接呼叫外部 production API origin。
- Admin client 只能使用 `/api/admin/...`。
- Ordering client 只能使用 `/api/ordering/...`。
- Public browser refresh 使用對應的 same-origin `/api/...` route。
- API client 應統一處理 JSON response、HTTP error、專案錯誤碼與網路錯誤，不讓每個 component 各自解析一套格式。

### API route handler

API route 負責 HTTP 邊界，不複製後端商業邏輯。必要責任包含：

- 驗證參數與允許的 resource。
- 轉發必要的 headers、cookie 或 token。
- 執行 mutation 的 same-origin 檢查。
- 設定適當的 cache policy、timeout 與 response status。
- 將 upstream 失效轉換成穩定、可辨識的錯誤 response。

後端商業規則、交易狀態轉移與資料一致性仍由後端 API 負責。

## 6. Snapshot 與公開頁面容錯

- `data/snapshots/` 是公開頁面的 degraded-mode 資料來源，不是交易資料的真實來源。
- Snapshot 應由 `scripts/snapshot-*.mjs` 依後端 API 產生。
- 公開頁面在 API 不可用時，應盡量保留可讀的既有內容或明確顯示失敗狀態。
- 需要即時一致性的後台操作、訂單提交與狀態轉移，不得依賴 snapshot 完成。
- 頁面顯示狀態應由同一份 `pageVisibility` 資料控制；導覽隱藏不能取代 route-level 的實際存取判斷。

## 7. 樣式與視覺層

樣式依產品區域隔離：

- Public：`styles/public/`
- Admin：`styles/admin/`
- Ordering：`styles/ordering/`

Public layer 的載入順序固定為：

```text
00-foundation
10-page-layouts
20-theme-history
30-pearl-theme
40-refinements
```

Admin layer 的載入順序固定為：

```text
00-foundation
10-management
20-ordering
30-public-previews
40-dark-and-operational
```

規則：

- 不得任意調換 layer import 順序。
- `theme-history.css` 即使名稱表示歷史，也可能是目前 cascade 的必要基礎，不得未經視覺確認就刪除。
- Ordering 樣式保持在 `styles/ordering/`，不可混入 Public 或 Admin 樣式。
- 修改共用 selector 時，必須檢查 desktop、mobile、dialog、loading、error 與 active 狀態。
- 動畫與 parallax 必須尊重 `prefers-reduced-motion`。

## 8. 互動、可及性與資源清理

- 互動元件應使用語意化 HTML，並提供必要的 `aria-*` 狀態與 label。
- 可操作元素必須支援鍵盤操作與可辨識的 focus state。
- 非同步操作應具備 loading、error 與取消請求的處理。
- `useEffect` 建立的 event listener、timer、AbortController 或 object URL 必須在 cleanup 時清理。
- 不得以刪除 accessibility attribute、停用鍵盤操作或移除 reduced-motion 支援來解決視覺問題。

## 9. 測試、建置與發布

- 路徑搬移、API client 變更、樣式 layer 變更與 route 變更時，應同步檢查相關契約測試。
- 一般合併前檢查包含 build、lint 與必要的非 E2E 測試。
- `dev` 部署依專案政策預設跳過所有自動化測試；除非明確要求，不執行 unit、integration、E2E 或 browser test。
- Web 變更必須先進 `dev`，確認 `www-dev.marchgroup.net` 運作正常後，才由 `dev` 推進 `main`。
- 不得用 production `main` 部署作為未確認變更的測試路徑。

## 10. 變更原則

- 機械性搬移與行為變更應盡量分開。
- 修改前先確認檔案所屬責任與依賴方向。
- 不為了短期方便，把外部 API URL、domain state 或頁面流程塞入共用層。
- 若新需求無法自然放入現有 domain，先調整模組邊界，再開始堆疊功能。
- 新增例外時，必須在程式碼或文件中說明例外原因與影響範圍。
