# 清醒夢網站程式編寫規則

更新日期：2026-09-12。盤點基準：`ToBeClarify-web` 的 `a8c5151`。

本文件是公開網站、顧客點餐與管理後台的開發規範，依目前原始碼、設定與工作流程重寫。[盤點紀錄](coding-standards-audit-20260912.md)另列現況、文件差異與待改善項目；本規範不代表全站已全部符合。

「必須／不得」是必要規則；「應」是預設做法，偏離時須說明理由；「可以」是允許的選擇。規則適用於新增與修改範圍，既有差異依影響漸進處理，不要求每次修改都全面重構。

使用者當次要求與工作區、儲存庫的 `AGENTS.md` 優先於本文件。架構文件說明責任分工，部署文件說明操作步驟；兩者不得另訂互相矛盾的編寫或發布政策。

## 1. 適用範圍與技術基準

| 項目 | 目前基準與規則 |
| --- | --- |
| 主專案 | `ToBeClarify-web`；相鄰的 `LUCID-DREAM` 是另一份 checkout，不作為本次改寫依據，也不自動同步修改 |
| 產品範圍 | 公開站、`/order` 顧客點餐、`/admin` 後台；包含包廂、營運看板、排班、結算及通知 |
| 執行環境 | React 19、Vinext App Router、Vite、Node.js；正式環境由 IIS 反向代理至 PM2 管理的 Vinext 程序 |
| 版本來源 | `package.json`、`package-lock.json` 與 CI；目前 Node.js 最低 `22.13.0`，實際鎖定設定是版本依據 |
| 套件管理 | 使用 npm 與既有 lockfile；CI 使用 `npm ci`，套件變更同步 lockfile，不另增第二套 lockfile |
| 後端邊界 | `ToBeClarify-api` 負責授權、商業規則及持久化；本文件規範 Web 串接，不取代 API 專案規則 |
| 藍圖站 | `ordering-blueprint-site` 是獨立專案，遵守自己的 `AGENTS.md` 與工作區藍圖驗證政策 |

不得因公開頁面具有快照就改成純靜態發布；API route、登入、動態頁面與點餐仍需要伺服器。`next/*` 匯入是現有 Vinext 相容介面，不代表部署使用 Next.js CLI。

## 2. 語言、型別與可讀性

- 新增應用程式碼使用 `.ts`／`.tsx`。既有 `.js`／`.jsx` 實質修改時應評估一併轉換；小修可維持原副檔名，若實質修改仍延後轉換，須記錄原因與影響。
- 建置設定、Node 腳本與既有測試可沿用 `.mjs`，IIS 維運腳本沿用 `.ps1`；不要為副檔名一致而更換工具鏈。
- 維持 TypeScript `strict`。不得以 `any`、大範圍型別斷言、`@ts-ignore`、`@ts-nocheck` 或放寬設定掩蓋契約問題。
- 外部 JSON、URL 參數與瀏覽器儲存內容先視為未知資料，在使用前檢查型別、必要欄位及範圍。`as T` 與 `request<T>()` 不等於執行期驗證。
- API request／response、共用 props 與狀態應有具名型別。對外契約放在所屬功能的 `types.ts` 或明確命名的 contract 檔；僅元件內使用的 props 可以留在元件旁。
- 型別匯入使用 `import type`；跨功能的型別檔不得同時輸出 API client、元件或執行期邏輯。
- 元件與型別使用 PascalCase，函式、變數、props 使用 camelCase，Hook 以 `use` 開頭，固定常數可使用 UPPER_SNAKE_CASE。API 欄位與狀態值保留後端契約名稱。
- 新增功能資料夾使用小寫或 kebab-case，元件檔使用 PascalCase。既有公開路徑如 `/staffRanking` 不因命名整理而改名。
- 新檔預設使用兩個空白縮排、雙引號、分號及合理換行；局部修改既有檔案時維持周邊格式。這是人工審查規則，目前沒有統一的 Prettier 設定。
- 不把整個元件、流程、型別或 CSS 規則群壓成單行。註解說明限制、原因與例外，不重述程式碼。
- 不設機械式行數上限；當一個檔案同時管理多個流程、請求與大型畫面時，依責任拆成元件、Hook 或純函式。

## 3. 目錄與依賴方向

| 位置 | 應負責的內容 |
| --- | --- |
| `app/` | 路由、layout、metadata、頁面資料組合、HTTP handler |
| `features/<domain>/` | 該功能的 UI、互動狀態、API client、server data、型別與邏輯 |
| `features/admin/` | 同一後台範圍內的 auth、shell、shared、media 與各管理功能 |
| `components/` | 跨功能且不含特定商業流程的展示、版面與互動元件 |
| `lib/`、`lib/server/` | 中立的基礎工具；`server/` 僅供伺服器設定與工具使用 |
| `data/snapshots/` | 公開內容的容錯快照，不放帳號、憑證或交易真實狀態 |
| `styles/`、`public/` | 分區樣式與網站靜態素材 |
| `scripts/`、`deploy/` | 快照生成、建置、部署與維運工具 |
| `tests/` | 供適用情境執行的自動化測試；執行條件見第 10 節 |

依賴方向：

```text
app 頁面／route → feature 入口、feature server data、共用元件
feature → 同功能模組、components、lib
feature → 其他功能的純型別契約（僅 import type）
components／lib → 中立共用模組；不得反向依賴 feature 執行期實作
```

- `features/A` 不得直接引用 `features/B` 的元件、server data、API client、state 或 CSS。需要跨功能組合時，由 `app/` 取得資料並傳入各功能元件。
- `features/admin/` 各子模組可使用同一後台的 auth、shared、media 等共同能力，但不得形成循環依賴。
- Feature 不得 import `app/` 實作。瀏覽器元件及其依賴不得 import `lib/server/` 或 feature 的 `server/`。
- 跨目錄匯入優先使用 `@/`，同模組可使用相對路徑。Node 直接載入的腳本或契約檢查若需要明確副檔名，保留必要路徑，不為統一外觀破壞執行方式。
- 共用 UI 抽到 `components/`，中立工具抽到 `lib/`；共用商業能力須先建立明確責任邊界，不把特定領域實作藏進共用元件，也不藉 barrel re-export 繞過限制。
- 目前跨功能限制與 server-only 邊界主要依賴人工審查；不得宣稱 ESLint 已完整強制這些規則。

## 4. 頁面、路由與 React

- App Router 是唯一的路由表。`page.tsx` 保持薄層，負責參數、metadata、資料組合、可見性及 `notFound()`／redirect，將互動與大型 JSX 放到 feature。
- 公開頁面的導覽與直接網址存取應使用相同的 `pageVisibility` 契約。隱藏選單不等於禁止進入頁面；快照中的可見性也不能作為敏感資料授權。
- 動態 route 依目前介面取得 `Promise` 形式的 `params`，檢查參數後再使用；新增或更名網址時保留必要的舊連結轉址，例如現有 `/meun` → `/menu`。
- Server 元件負責可在伺服器完成的讀取。需要 Hook、事件或瀏覽器 API 時，在必要的互動邊界加上 `"use client"`，不把整個公開頁面樹轉為 client。
- 不在可能被伺服器執行的模組頂層讀取 `window`、`document`、儲存空間或音訊 API；瀏覽器能力須在適當生命週期判斷並初始化。
- 後台頁面選擇 `features/admin/shell/AdminRoutes.jsx` 的 route entry；由同一套保護元件處理登入、載入、錯誤及角色導向，不另建 pathname switch 路由器。
- `AdminProviders.tsx` 統一管理 auth、toast、圖片處理、主題與登入後的通知 provider；頁面不可各自重建全站通知串流。
- 狀態以單一來源管理，能由 props／現有 state 推導的值不重複保存；Effect 用於外部同步，mutation 由使用者事件或明確流程觸發。
- 列表使用穩定 ID 作為 key；會新增、刪除或排序的列表不得只用陣列索引。非同步結果不得覆蓋較新的查詢、使用者或編輯狀態。
- 預覽頁須清楚標示模擬資料與操作範圍。模擬送出不得建立真實交易，也不得在真實 API 失敗時切換為模擬成功。

## 5. 資料取得與 HTTP 邊界

### 5.1 伺服器資料與公開快照

- 伺服器資料放在所屬 feature 的 `server/`。現有 `features/site/server/data.ts` 是公開網站彙整入口，頁面可由此組合首頁、菜單、相簿等資料，不讓其他 feature 實作反向依賴它。
- 應用程式的 upstream API origin 統一由 `lib/server/upstream-config.ts` 讀取。保留既有預設值及環境變數覆寫能力；不得接受使用者提供任意上游 origin。
- 每個上游請求必須明確處理逾時、HTTP／業務錯誤及 fallback。需要取消的請求傳遞 signal；背景刷新須處理拒絕與重複請求。
- 快取須說明資料範圍、更新時機與失敗策略。程序記憶體快取只適用可接受短暫過期的公開讀取，不得保存跨使用者交易或登入狀態。
- `site.json`、`staff.json`、`rooms.json` 只支援公開內容降級。不得用快照判定真實餘額、包廂空位、授權或完成訂單。
- 快照更新優先使用既有 `snapshot:site`／`snapshot:staff` 指令並檢查差異；目前沒有包廂專用生成指令，更新 `rooms.json` 時須記錄來源及更新方式。
- 快取 TTL、逾時與重試間隔集中於設定或具名常數，依功能需要決定，不把目前數字寫成永遠不變的規則。

### 5.2 瀏覽器 API client

| 用途 | 入口 |
| --- | --- |
| 後台一般操作 | `features/admin/api/client.js` → `/api/admin/...` |
| 後台通知 | `features/admin/notifications/api.ts` → `/api/admin/notifications...` |
| 顧客點餐 | `features/ordering/api/client.js` → `/api/ordering/...` |
| 公開資料刷新 | 對應的 `/api/public/...`、`/api/staff/...`、`/api/guestbook/...` 等 route |

- 瀏覽器的業務 API 請求必須使用同源 `/api/...`，不能直接呼叫正式 upstream API。API 回傳的公開圖片／媒體 URL 可以作為素材來源，但不要在功能程式新增寫死的正式媒體位址。
- 同功能的請求應走既有 client，避免在每個元件複製 `fetch` 與錯誤解析。通知可保留自己的入口與串流契約，不強迫與點餐共用業務 client。
- Client 應保留 HTTP status、穩定錯誤碼及可用的 trace ID，統一轉成可呈現的錯誤；判斷邏輯使用錯誤碼而非比對中文訊息。
- 應區分無效 JSON、契約缺欄、正常空資料與服務失敗；只有端點契約明定無 body 時，才把空回應視為成功。取消請求維持取消語意，不顯示成網路故障。
- URL 路徑片段使用 `encodeURIComponent`，query 使用 `URLSearchParams`。`FormData` 不手動設定 multipart 的 `Content-Type`，讓瀏覽器產生 boundary。

### 5.3 API route handler

- Route handler 處理 HTTP 轉接與邊界驗證，價格、交易狀態、資料範圍與一致性由 API 決定。
- JSON body 須先檢查資料形狀與欄位型別，再執行 `.trim()` 等操作；無效輸入回傳明確的 4xx，不能依靠 TypeScript 斷言避免執行期錯誤。
- 動態 resource 使用允許清單；只轉發必要 header，保留必要的 query、cookie、點餐 token 與串流 cursor，不無條件複製所有 headers。
- Mutation 必須套用適合該端點的來源／CSRF 防護。現有 admin／ordering proxy 的來源檢查不得刪除；涉及反向代理 header 時須依可信代理設定判斷。
- 保留 upstream 的有效 HTTP 狀態與內容型別；HEAD、204、205、304 等無 body 情境不得強行組入內容。逾時與上游故障回傳穩定的錯誤格式及合適的失敗狀態。
- 後台、登入、點餐與交易資料使用 `no-store`；公開資料只有在允許短暫過期時才使用公開快取。
- SSE 通知保留串流 body、事件位置與斷線取消；不能先讀完整份 body 再回傳。串流與一般 JSON 請求可有不同逾時設定。
- 既有公開 routes 有「直接 data」與 `{ error }` 等回應形式，修改時須維持既有 client 相容性；統一格式必須連同呼叫端一起調整。

## 6. 身分、權限與敏感資料

- 後台使用既有 cookie 登入流程，client 保留 `credentials: "include"`；不得另把後台密碼或管理 token 存入 `localStorage`。Proxy 的 cookie 處理須保留正式 HTTPS 與 HttpOnly 保護。
- 顧客點餐以 `X-Order-Token` 傳遞現有信物。既有網址 code／本機保存是相容流程，不得擴充為記錄完整憑證到日誌、錯誤訊息或分析事件。
- 前端的 `developer`、`manager`、`clerk` 顯示與操作限制須對齊 API。隱藏按鈕與 route guard 是使用者介面規則，真正授權仍由 API 檢查。
- 登出、切換帳號或登入失效時，清理使用者資料、未完成請求、通知與音訊，不可讓下一位使用者看到上一位的狀態。
- 環境變數、連線字串、JWT key 及一次性驗證碼不得提交 Git；`.env.example` 僅列設定名稱、非機密預設與說明。
- 不將使用者輸入直接當成 HTML 執行。需要富文字時，須有明確格式與清理邊界。
- 直接 SQL 維護帳號的刪除限制不等同於 API DELETE 權限；也不限制移除尚未送出的購物車項目。涉及後端或資料庫時依 API 專案規範處理。

## 7. 點餐、營運、結算與通知

### 點餐及管理操作

- 金額、折抵、套餐內容、包廂占用及狀態轉移以 API 回傳為準；前端可以估算與預覽，不能把估算當作最終報價。
- 需要正式報價的流程須使用 `quoteToken` 與 `expiresAt`。購物車變更或報價到期後重新取得報價，讓使用者確認最新金額；不繞過報價失效或需店內確認狀態。
- 送出、結算、廣播等 mutation 應防止重複點擊。後端提供 idempotency key 的端點沿用契約；不假設所有端點都具備防重能力。
- 請求失敗須保留可恢復的輸入。交易結果不確定時，先讀回狀態再決定是否重送，避免自動重試造成重複交易。
- 狀態代碼對照中文標籤集中於所屬功能，未知值保留可辨識的降級顯示；不得在不同畫面各自發明狀態轉換。

### 日期、時間與金額

- 顯示文字使用繁體中文，日期／數值格式預設 `zh-TW`，營業時間顯示明確指定 `Asia/Taipei`。
- 區分帶時區的時間點、`datetime-local` 輸入與營業日字串。`businessDate` 依 API 的營業日契約處理，不直接用瀏覽器日曆日或 `toISOString().slice(0, 10)` 取代，避免跨午夜錯日。
- 金額沿用 API 的數值單位與精度，清楚標示 G／Gil；`priceText` 是顯示文案，不可回頭解析成計算價格。
- 排班、場次、結算鎖定與重開的資格由 API 判定，前端只處理輸入、狀態呈現與結果更新。

### 通知與瀏覽器資源

- 通知由登入後的 provider 統一管理，保留 capabilities、cursor、重新同步、去重與重連的契約；不得因重連或多分頁重複播放同一通知。
- 已讀、已確認、已撤回與已過期是不同狀態；關閉提示不自動等同於已確認。
- 音效與桌面通知由使用者操作啟用；權限拒絕、儲存不可用或播放失敗時仍保留可讀通知。
- Effect 建立的 listener、timer、AbortController、EventSource、BroadcastChannel、object URL 及音訊資源，必須在結束或依賴變動時清理。

## 8. 樣式、共用控制項與可及性

樣式入口與順序以以下檔案為準。這些是依 `@import` 順序疊加的 CSS 檔案，不代表已建立原生 CSS `@layer` 隔離。

| 分區 | 入口 | 目前匯入順序 |
| --- | --- | --- |
| 公開站 | `styles/public/site.css` | `tailwindcss` → `00-foundation` → `10-page-layouts` → `20-theme-history` → `30-pearl-theme` → `40-refinements` |
| 後台 | `styles/admin/site.css` | `00-foundation` → `10-management` → `20-ordering` → `30-public-previews` → `40-dark-and-operational` → `50-modern` → `60-settlement` → `70-notifications` → `80-controls` |
| 顧客點餐 | `styles/ordering/site.css` | `base.css` → `modern.css` |

- 不任意調換載入順序或刪除歷史樣式；`theme-history` 仍可能提供後續覆寫依賴的基礎。
- 根 layout 載入公開樣式，後台與點餐再載入自己的入口，三者不是完全獨立的樣式作用域。修改全域 selector 必須評估跨頁影響。
- 新樣式放到所屬分區，使用該分區容器或既有 class 命名限制作用範圍。後台內的點餐管理樣式仍屬 admin，不與顧客 `/order` 樣式混用。
- 優先使用既有 CSS variables、控制項與色彩層次；[色彩文件](design-palette.md)含歷史紀錄，最終呈現仍以目前 CSS 為準。
- 先修改負責該樣式的宣告，避免無止境追加同 selector、提高 specificity 或使用 `!important`。確有必要時說明影響範圍。
- 後台操作沿用 `AdminShared` 的按鈕、欄位、dialog、toggle 與既有 Base UI 控制項，避免重寫每個頁面的互動規則。
- 按鈕使用 button、導覽使用連結；表單欄位有 label，純圖示按鈕有可讀名稱。保留鍵盤操作、可辨識的 focus 與正確的 `aria-*` 狀態。
- Dialog 應管理初始焦點、焦點限制、關閉與焦點返回；需要明確確認的流程按產品契約決定關閉方式。
- 畫面具備 loading、empty、error、disabled、pending／success 等適用狀態；不可只靠顏色表達重要狀態。
- 樣式變更檢查桌機、手機、後台明暗主題及受影響 dialog。動畫與 parallax 尊重 `prefers-reduced-motion`。人工視覺檢查不代表可自動啟動瀏覽器測試，執行限制見第 10 節。
- 圖片提供適當 alt、尺寸或比例，非首屏素材按需要延遲載入；上傳流程沿用既有圖片處理與 media API，預覽 object URL 用完即釋放。

## 9. 工具與例外管理

- 依 `eslint.config.mjs` 執行 React、Hooks、可及性、TypeScript 與 Next 相容規則，不為消除錯誤而全域停用規則。
- 既有檔案豁免及行內 disable 是待整理的相容項目，不是新元件的模板。新例外必須限制到最小範圍，說明原因、影響及移除條件。
- `allowJs: true` 支援漸進遷移，不代表既有 JS／JSX 已接受完整 strict 檢查；目前未開啟 `checkJs`。
- 新增套件前先確認既有能力是否足夠；確需新增時交代用途與執行環境，避免引入另一套路由、狀態、UI 或套件管理方式。
- 生成物與本機狀態依 `.gitignore` 排除；不要把 `dist`、`.next`、`.wrangler`、型別快取與臨時輸出當原始碼提交。公開快照是已明確管理的例外。
- 只更動需求所需範圍；大規模格式整理、搬移與行為變更應分開。規則或架構有例外時同步更新文件，不能用舊例外默許新違規。

## 10. 驗證與發布

### 10.1 檢查指令及適用時機

| 檢查 | 指令／方式 | 執行原則 |
| --- | --- | --- |
| 建置 | `npm run build` | 應用程式或影響產物的設定修改；dev 發布必要檢查 |
| 型別 | `npm run typecheck` | TypeScript／契約／路徑修改；目前 CI 會執行 |
| 靜態分析 | `npm run lint` | 程式碼修改；目前 CI 會執行 |
| 文件檢查 | 相對連結、命令與路徑核對、差異及 `git diff --check` | 純文件修改；不需要為此建置整站或新增自動化測試 |
| 自動化測試 | `npm run test:non-e2e`；`npm test` 另含建置 | 依使用者要求及適用的 PR／正式驗證政策選擇；不得列為 dev 發布預設步驟 |
| 部署可用性 | 工作流程狀態、`/api/health` 與需要時的 `/api/health/dependencies` | 確認程序、部署 SHA 與相依服務可用性；不代表完整功能驗收 |

上述 npm 建置／啟動 script 含 POSIX 環境變數語法。Linux CI 可直接執行；Windows PowerShell 的等效方式見 [README](../README.md)，不要把 shell 語法錯誤誤判為應用程式建置失敗。

`tests/` 現有內容包含 Node test runner、原始碼契約與渲染檢查；名稱含 `UI` 或 `rendered` 不代表已做實際瀏覽器 E2E。PR 工作流程另有隔離的 PM2 crash-recovery smoke；它屬 PR 驗證，不能移入 dev 部署流程或稱為單純 HTTP health check。

### 10.2 測試環境的優先政策

- `dev` 發布前、發布中及發布後，預設跳過全部自動化測試套件；只有使用者明確要求該次測試時才執行。
- 允許的發布驗證限於 build、型別／lint 等靜態及設定檢查、部署狀態與操作性的 HTTP 可用性檢查。
- 不執行 unit、component、integration、E2E、Playwright、Cypress、Selenium 或其他瀏覽器／完整操作流程測試；不能以「非 E2E」「合併前」或「smoke」名義繞過該次發布限制。
- 測試指令保留供明確要求或手動使用，不得成為 dev 部署 job 的必要測試關卡。PR 與正式環境的測試政策分開，不由此推論全部禁止。
- 藍圖站預設以成功建置、Sites package validation 與 Sites deployment status 驗證；除非使用者要求，不執行 E2E 或其他自動化測試套件。

### 10.3 環境與正式發布

1. 開始前確認工作區狀態與所屬專案，保留未提交修改；新功能分支預設 `codex/`，以當前 `dev` 為基準。
2. Web 程式與設定先進 `dev`；推送 `dev` 即發布至 `https://www-dev.marchgroup.net`。
3. 完成允許的部署檢查後，記錄部署的 dev commit SHA，等待使用者明確確認該版測試站運作正常。不得把 health check 成功當作使用者確認。
4. 確認後，僅以人工 `dev` → `main` PR 推進，PR 必須包含同一個已驗收的 dev commit，再手動合併。若 `dev` 已新增未驗收變更，必須重新確認；不得將 feature branch 直接發 PR 或推入 Web `main`。
5. 推送 `main` 是正式發布，必須已有明確確認；不能用正式工作流程作為確認前的測試途徑。部署失敗依既有 IIS 回復機制處理。

API 沒有獨立測試主機。若需求明確要求 Web／API 一起部署到「測試環境」，Web 進 `dev`，API 依自己的正常正式流程進 `main`；API `dev` 仍僅做 build／artifact 驗證。前後端契約變更須考慮共用 API 對目前正式 Web 的相容性。

## 11. 交付前檢查清單

- [ ] 已確認所屬功能、頁面入口、依賴方向及 server／client 邊界。
- [ ] 新增程式使用適當型別，輸入與回應有必要驗證；未擴大 lint／型別例外。
- [ ] API、權限、金額／時間、錯誤及取消處理符合受影響功能的契約。
- [ ] loading、empty、error、重複操作、資源清理與可及性已按變更範圍檢查。
- [ ] 樣式放在正確分區，載入順序、共用控制項與既有網址相容性保持合理。
- [ ] 只執行該次情境允許且相關的驗證，記錄通過、失敗、未執行及原因，不宣稱未做的檢查已通過。
- [ ] 契約、設定、路徑或流程變更同步更新必要文件；新技術債記錄原因與後續處理範圍。
- [ ] 交付說明包含改了什麼、為何修改、如何驗證，以及是否已發布；正式推進具備使用者確認。
