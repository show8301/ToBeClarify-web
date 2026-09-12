# 網站程式編寫規則盤點紀錄

盤點日期：2026-09-12。來源：本機 `ToBeClarify-web`，HEAD `a8c5151`，分支 `codex/menu-ordering-ready`；本機記錄的 `origin/dev` 同指該提交。未向遠端重新取得版本，因此此紀錄不代表線上部署狀態。

本次以讀取原始碼、設定、既有規範及靜態搜尋盤點，並重寫[程式編寫規則](coding-standards.md)。未執行應用程式建置、自動化測試、瀏覽器操作或部署；未修改產品程式、API、資料庫或工作流程。

## 1. 範圍與數量

來源碼統計限定 `app/`、`features/`、`components/`、`lib/` 的 `.ts`、`.tsx`、`.js`、`.jsx`，不含套件、產物、樣式、快照、worker、工具及測試。

| 副檔名 | 檔案數 |
| --- | ---: |
| `.ts` | 24 |
| `.tsx` | 62 |
| `.js` | 5 |
| `.jsx` | 19 |
| 合計 | 110 |

- 應用程式仍有 24 個 JS／JSX 檔，主要位於後台與顧客點餐，不是全面 TypeScript 的專案。
- 功能目錄已包含公開站、包廂、點餐及後台的營運、排班、結算、通知等功能。
- `LUCID-DREAM` 為另一份較早 checkout，未納入修改；`ordering-blueprint-site` 與 API 保留各自規範。

## 2. 已存在的規則與執行情形

| 項目 | 觀察結果 | 主要依據 |
| --- | --- | --- |
| 執行方式 | Vinext／Vite、React 19、Node.js；IIS 與 PM2 部署 | `package.json`、`vite.config.ts`、`.github/workflows/deploy.yml`、`docs/iis-dev-deployment.md` |
| 語言 | `strict: true`、`allowJs: true`，未啟用 `checkJs`；仍保留 JS／JSX | `tsconfig.json`、上述檔案統計 |
| 依賴邊界 | 本次單行靜態 import 掃描找到 9 個跨 feature 匯入，皆為 type-only；此掃描不涵蓋全部動態 import 或 re-export | `features/`；型別契約主要來自 site、staff、rooms |
| 工具防線 | CI 執行 build、typecheck、lint；未設定完整跨 domain／server-only 匯入限制或統一 formatter | `eslint.config.mjs`、`tsconfig.json`、CI；未見 Prettier／EditorConfig 設定 |
| 後台組合 | App Router、集中 route guard／provider；登入後才掛載通知 provider | `features/admin/shell/AdminRoutes.jsx`、`AdminProviders.tsx` |
| API 串接 | admin、ordering、notifications 各有同源 client；執行期 upstream 集中 | `features/admin/api/client.js`、`features/ordering/api/client.js`、`features/admin/notifications/api.ts`、`lib/server/upstream-config.ts` |
| 公開容錯 | site、staff、rooms 有快照及 server data；目前只有 site／staff 生成指令 | `data/snapshots/`、對應 `server/data.ts`、`scripts/snapshot-*.mjs` |
| 樣式 | 公開站 5 個編號檔、後台 9 個編號檔，點餐為 base／modern；共用全域 cascade | 三個 `styles/*/site.css`、`app/layout.tsx` |
| 自動化測試 | Node test runner 的契約與渲染檢查仍可手動使用；PR 另有 PM2 smoke | `package.json`、`tests/`、CI |
| 部署檢查 | dev push 的 build／部署路徑未呼叫 `npm test` 或 `test:non-e2e`；PR 的 PM2 smoke 是獨立條件，涵蓋同 repository 的 dev／main PR | `.github/workflows/deploy.yml` |

以上是實作觀察，不能推論所有頁面、錯誤分支、權限或線上行為均已驗證。

## 3. 本次文件修正

| 舊文件問題 | 新版處理 |
| --- | --- |
| 規範以 2026-09-01 重構為基準 | 更新為本次提交與盤點日期，分開記錄現況與要求 |
| 「全部新增程式都不能用 JS」未區分應用與工具 | 應用程式新增 TS／TSX；保留 `.mjs` 設定、腳本與既有測試的工具需求 |
| `architecture.md` 允許必要時跨 feature 引用公開實作，與規範禁止 runtime 跨 domain 相衝突 | 統一為跨功能僅允許純型別契約，頁面在 `app/` 組合資料 |
| Admin layer 清單只到 `40-dark-and-operational` | 補齊 `50-modern`、`60-settlement`、`70-notifications`、`80-controls`，說明匯入順序不等於 CSS `@layer` 隔離 |
| Provider 說明未包含通知，功能清單漏列包廂 | 同步目前目錄與登入後通知的責任 |
| 缺少近期商業功能的開發規則 | 補上正式報價、重複送出、營業日、時間區域、結算、通知串流及資源清理 |
| README／架構文件把非 E2E 測試混在一般檢查，未清楚排除 dev 發布 | 分開靜態檢查、自動化測試及發布政策；保留 PR 驗證的獨立情境 |
| IIS 說明對 dev PR 表示跳過所有測試，但同文件與 CI 又有 PR PM2 smoke | 改為如實描述現有 PR 行為；明確區別 dev push 的發布檢查 |
| 本機操作只列 POSIX script | README 補 Windows PowerShell 等效啟動／建置方式，保留原工具與 workflow |

## 4. 保留的實作差距與後續方向

本次只修改文件。下列是程式後續整理方向，未在這次完成，也不應因為規範已更新就標記修復。

| 差距 | 可定位的例子 | 後續處理方向 |
| --- | --- | --- |
| JS／JSX 的型別遷移未完成，部分元件與型別壓縮成長行 | `features/admin/staff/AdminStaffSettingsPage.jsx`、`features/ordering/components/OrderClient.jsx`、`features/admin/notifications/types.ts` | 實質修改時拆分責任、展開格式並補型別；不在小修內全面翻寫 |
| Client 錯誤契約不一致 | `features/ordering/api/client.js` 的 catch 將取消轉成網路錯誤；`features/admin/notifications/api.ts` 僅保留 status；admin／ordering 的無效 JSON 可能回傳 undefined | 補上取消語意、必要欄位驗證及穩定錯誤資訊，維持既有端點相容 |
| 公開 mutation 尚未全面符合邊界規則 | `app/api/guestbook/route.ts`、`app/api/guestbook/[id]/replies/route.ts` 使用型別斷言後直接 trim；未見與 admin／ordering 相同的來源檢查及完整上游例外轉換 | 先定義匿名留言輸入、防護與錯誤契約，再同步 route／client |
| 可見性判斷並未在每個詳細頁一致執行 | `app/gallery/[id]/page.tsx` 讀取 `home.pageVisibility` 並交給 SiteChrome，但未像 `app/menu/rooms/page.tsx` 在 route 先判斷可見性 | 後續修改時核對列表、詳細頁與直接連結的產品行為 |
| 預覽入口仍包含大型 UI 與寫死的正式媒體 URL | `app/order/preview/page.tsx` | 將預覽 UI／示例資料移到適當 feature，避免新增正式媒體位址常數 |
| 快照工具與環境設定尚未統一 | `snapshot-site.mjs` 寫死 API 且 fetch 未設 timeout；`snapshot-staff.mjs` 也寫死 API；rooms 無生成指令 | 在修改快照流程時集中設定、補逾時及可重現的 rooms 來源 |
| 日期顯示未全面明確指定台灣時區 | `OrderClient.jsx` 多處只傳 `zh-TW`；`operationsFormat.ts` 已明確指定 `Asia/Taipei` | 逐步統一，分清楚時間點、當地輸入與營業日 |
| 部分規則仍需人工審查，且有檔案／行內 lint 豁免 | `eslint.config.mjs`、`AdminNotificationCenter.tsx` | 不擴大豁免；另行處理匯入邊界、formatter 與例外移除，不把它們描述為已落地 |

優先整理 API 取消／錯誤、公開輸入驗證及交易時間的差異，再隨功能修改處理型別、元件拆分與格式。上述方向不是額外部署或測試授權。

## 5. 維護方式

- 後續開發以 [coding-standards.md](coding-standards.md) 為規範，本紀錄保留本次盤點事實，不隨每次小修重寫歷史。
- 修復待改善項目時，以對應提交或新盤點紀錄交代完成範圍及實際驗證。
- 文件更新不能取代應用程式驗證；純文件整理也不需要為了交付而啟動全站測試或部署。

## 6. 後續上板前的環境分支核對

使用者後續明確要求依正常流程上板後，於 2026-09-12 重新取得 GitHub 分支：`dev` 為 `a8c5151`，`main` 為 `2c4ec14`（PR #52 合併）。兩個提交的檔案樹相同，皆包含更新前的 `AGENTS.md`、`README.md`、`docs/coding-standards.md`、`docs/architecture.md` 與 `docs/iis-dev-deployment.md`。

本次文件更新先發布至 `dev`；依正常工作流程執行建置、型別、lint、部署及操作性 HTTP 檢查，不執行自動化測試套件。正式環境仍須使用者確認該版 dev 後，再由 `dev` → `main` PR 人工推進。此節記錄上板前核對與流程，實際完成結果以 GitHub Actions 及環境回報的部署 SHA 為準；前述第 1–5 節保留原始文件盤點範圍。
