# 本地 UI 預覽：API 連通、CSS 與字型載入標準

更新日期：2026-10-10。適用於 `ToBeClarify-web` 的本地公開站、點餐入口及管理後台。每個新對話首次處理本地預覽，以及每次啟動、重啟、切換分支或更換建置模式後，須確認程序與所需 API 連通，並依本文件確認樣式與字型，再將畫面作為 UI 調整基準。

本機 UI 預覽預設使用 `http://127.0.0.1:3001` 的 production build，以取得目前有輸出的字型變數。3000 的 development mode 不再作為預設視覺確認入口；僅於明確要求熱更新或排查開發模式問題時使用。

本文件是操作規範，不會自動注入 CSS，也不代表本地字型問題已修復。發布仍遵守 [AGENTS.md](../AGENTS.md) 與[程式編寫規則](coding-standards.md)。

## 1. 啟動前確認來源

- 在 `ToBeClarify-web` 目錄執行；相鄰的 `LUCID-DREAM` 是另一份 checkout，不得混用其伺服器或樣式。
- 記錄 `git status --short --branch` 與 `git rev-parse HEAD`。比對正式站時，確認指定的正式版本來源；一般 UI 開發保留當前工作分支，不自動切到 `main` 或覆蓋未提交修改。
- 確認預覽連接埠的程序確實來自這份 checkout；沿用已確認的伺服器，不因連接埠被占用就把別的程序當成本站。
- Node.js 與依賴安裝方式依 [README](../README.md)。首次安裝或 lockfile 變動時使用 `npm ci`；不要為了預覽另換套件版本。

## 2. 必須載入的樣式

### 公開站與共用基底

[app/layout.tsx](../app/layout.tsx) 必須載入 [styles/public/site.css](../styles/public/site.css)，其目前匯入順序如下：

```css
@import "tailwindcss";
@import "./layers/00-foundation.css";
@import "./layers/10-page-layouts.css";
@import "./layers/20-theme-history.css";
@import "./layers/30-pearl-theme.css";
@import "./layers/40-refinements.css";
@import "./layers/50-guestbook.css";
@import "./layers/60-collection.css";
@import "./layers/70-section-spacing.css";
@import "./layers/80-menu-cards.css";
@import "../shared/select.css";
@import "../shared/icon-actions.css";
```

只保留入口匯入，不把這段另貼到頁面重複載入。實際順序以目前分支的入口檔為準；新增或調整入口時同步更新本文件，不得漏載後段覆寫，也不得因檔名包含 `history` 就跳過。

### 公開頁面大區塊留白

`70-section-spacing.css` 統一公開頁面的主要區段間距，沿用已確認的首頁基準：桌機上下各 `clamp(30px, 4vw, 62px)`；820px 以下上 34px、下 58px。共用變數為 `--public-section-space-start` 與 `--public-section-space-end`，新增公開頁面時將主要區段加入該檔的明確 selector 清單。

適用首頁、店員名單、活動相簿、菜單、包廂、即時動態、排行榜、留言牆／分享頁及作品領取頁；店員個人頁調整頁面外圍留白並保留工具列空間。頁首、頁尾、搜尋列、跑馬燈、卡片內距、相片燈箱及點餐嵌入面板不套用大區塊間距。頁首沿用既有高度，頁尾上下各 14px。

`80-menu-cards.css` 在共用區段間距後載入，負責菜單的費用、單點與套餐卡片。卡片用自然高度與換行容納新增費用、分類、長名稱、標籤及套餐子項目；桌面單點／套餐雙欄、平板雙欄直式卡、手機單欄圖文卡，359px 以下改為圖片在上。分類列桌面可換列、手機可橫向捲動；此檔不改菜單 hero 或其他頁面的卡片。

| 頁面範圍 | 額外樣式入口 | 載入規則 |
| --- | --- | --- |
| 公開站 | 無 | 根 layout 的公開樣式已包含首頁狀態標籤 |
| `/admin` | [styles/admin/site.css](../styles/admin/site.css) | 由後台 layout 載入，保留入口內所有 `@import` 的順序 |
| `/order` 及點餐預覽 | [styles/ordering/site.css](../styles/ordering/site.css) | 由相應頁面載入，順序為 `base.css` → `modern.css` → `shared/inline-help.css` → `shared/select.css` → `shared/icon-actions.css` |

後台與點餐仍繼承根 layout 的公開樣式及字型設定，不是完全獨立的 CSS 作用域。

後台入口包含 `95-scrollbars.css`，統一整頁、側欄、抽屜與內部清單的捲軸明暗配色。根層規則以 `:root:has(.adminTheme)` 限定後台範圍，預覽時確認離開後台後公開頁面不受影響；桌面側欄的品牌區與帳號工具列固定，中間 `.adminNav` 獨立捲動，捲軸不得碰到外層圓角邊框。窄螢幕側欄仍使用展開式導覽選單。設計基準見[後台 UI 設計規範](admin-ui-design-guidelines.md)。

服務員工作台新增 `96-service-workbench.css`，在捲軸層之後、既有指名工作台樣式之前載入。確認待辦篩選／展開、顧客區、開碼收款區及 760px 單欄規則；靜態產物檢查可用 [service-workbench.json](../scripts/preview-css/service-workbench.json)。此檢查不代表交易、computed styles 或 rendered fonts 已驗證。

交付工作台樣式 `92-delivery-workspace.css` 置於 `91-customers-and-delivery.css` 與 `95-scrollbars.css` 之間；預覽時確認 `.adminDeliveryColumns`、範圍切換、詳情頁籤與共用展開箭頭均包含在後台 bundle。

完整點單管理樣式 `93-orders-workspace.css` 在交付工作台之後、捲軸樣式之前載入。預覽時確認顧客資訊、現場帳款摘要、紀錄與表單樣式包含在 bundle；主要區塊沿用 18px 間距，表單與卡片內部使用緊湊配置。桌面顧客欄採 sticky 並依當下 viewport 的可用高度調整，只有清單內部捲動；頁面 shell 的橫向裁切採 `clip`，避免建立阻斷 sticky 的捲動容器。760px 以下改為一般文件流與有界高度。清單底部固定顯示展開名單位置與是否仍有下方內容，分類標頭可收合並保留計數。用 [admin-orders.json](../scripts/preview-css/admin-orders.json) 查核產物，再人工確認頂端／頁面捲動後、長名單、收合、手機與明暗主題。

顧客分類依既有逐客訂單查詢核對（同時最多 4 筆，更新或離頁會取消過期讀取），依優先順序分為待確認／需協調、待履約／服務中、狀態待確認、訂單已完成、僅取消／失效及尚未下單。未知狀態、數量不一致或讀取失敗不得歸入完成。訂單完成只代表履約，不代表帳款已結清。新邏輯與清單抽至 TypeScript 的 `CustomerPane.tsx`、`customerProgress.ts`；既有 `AdminOrdersPage.jsx` 本次只替換組合入口，保留 JSX，避免連帶改寫既有大型交易表單，後續實質修改那些表單時再遷移。

開立點餐碼採依內容寬度換行的表單，人物 ID 欄供 6 字、顯示名稱供 12 字，指名人數為 0–9；既有 UID 與產生按鈕接續排列。欄位標籤列高度一致，標籤及圖示置中、控制項對齊；伺服器文字以對稱內距置中並保留共用箭頭。一般填寫與舊 UID 說明使用下述標準行內說明；載入／錯誤／完整顧客 ID 與歸戶結果仍直接顯示。

經理工作台樣式 `94-manager-workbench.css` 在完整點單管理之後、捲軸樣式之前載入。確認 `.managerColumns`、`.managerTask`、`.managerChecklist`、明暗主題與手機斷點規則均包含在 bundle；現場待辦與帳款清單各自捲動，收班步驟與營運摘要依自然高度呈現。

營運控制為精簡狀態卡，桌機 `.managerColumns` 為等寬雙欄：左欄依序為營運控制、店內廣播與包廂服務，右欄當班人力填滿其欄寬，整列外緣與上下卡片對齊；1100px 以下依序改成單欄。營業計畫及時間／接單／暫停操作由 dialog 開啟；確認 `.managerBusinessPlanDialog` 的 compact 營業計畫使用日期獨立列、時間雙欄與手機單欄，不繼承完整頁面的標題最小欄寬。實際關店位於收班清單，營運卡不再常駐完整表單。經理出勤沿用服務及指名工作台的 `WorkbenchShiftBar` 及其共用樣式。

點餐碼與當班人力說明共用 [標準小驚嘆號](admin-ui-design-guidelines.md#標準行內說明小驚嘆號) `AdminHelp`；樣式入口於 `80-controls.css` 後載入 `styles/admin/inline-help.css`。確認 `.adminHelpTrigger`、`.adminHelpPositioner`、`.adminHelpPopup` 的 24px／16px 桌面幾何、44px 觸控點擊區、portal 層級、最大寬高、明暗主題及關閉控制項已輸出；實際 hover、鍵盤、觸控與渲染仍須人工確認。

### 字型 CSS

三個樣式入口另在最後匯入 `styles/shared/icon-actions.css`，遵循[純圖示操作按鈕標準](icon-action-design-standard.md)，共用桌面／觸控尺寸 token。

三個樣式入口均在自身分區樣式之後匯入 `styles/shared/select.css`，使用[全站原生下拉選單標準](select-design-standard.md)。預覽時須確認共用樣式沒有被舊的背景 shorthand 清除；多選清單不套用箭頭。

根 layout 使用 `next/font/google` 宣告字型，並把產生的 variable classes 放在 `<body>`。瀏覽器必須同時取得相應的變數規則與 `@font-face`；只有 class 名稱或字型檔 HTTP 200 都不足以判定成功。

| CSS 變數 | 預期字型 | 目前設定 |
| --- | --- | --- |
| `--font-geist-sans` | `Geist`，含產生的 fallback | `subsets: ["latin"]` |
| `--font-geist-mono` | `Geist Mono`，含產生的 fallback | `subsets: ["latin"]` |
| `--font-noto-sans-tc` | `Noto Sans TC`，含產生的 fallback | variable weight、`display: "swap"`、`preload: false` |

目前 Vinext production HTML 以 `<style data-vinext-fonts>` 輸出字型 CSS，字型 URL 位於 `/_next/static/_vinext_fonts/`。開發模式或未來版本可能改用其他注入方式，以實際 DOM、CSSOM 與字型載入結果判定。Noto Sans TC 未設定預載，因此沒有 preload link 本身不是失敗；應確認所需字元的字型分片載入成功。

本地開發常見的 CSS URL 是 `/styles/public/site.css`；production build 常見為 `/_next/static/css/index.<hash>.css`。路徑不同是正常的打包差異，不能只靠檔名判定內容一致或不一致。不得寫死正式站的 hash、複製舊 bundle 作為原始碼，或直接引用正式站 CSS 來補本地載入。

## 3. 本地啟動方式

點單管理顧客摘要的「消費紀錄」與「點餐管理」採並排卡片；以摘要容器寬度 760px 為界改為上下排列，點餐管理標題維持 18px。消費紀錄的項目與金額等大並列，補充內容使用 `AdminHelp`；載入、錯誤與入場費未登錄仍直接顯示。經手店員優先顯示帳款回應的 `createdByDisplayName`，舊 API 僅能以登入者 ID 相同的紀錄回退至本人名稱；其他紀錄顯示「名稱尚未取得」。完整跨店員名稱依賴 [API 增量欄位](../../ToBeClarify-api/docs/FINANCE-ACTOR-DISPLAY-NAME.md)，不能宣稱僅更新 Web 就已完成此項驗證。

### 3.1 新對話與程序的外連權限

2026-10-09 與 2026-10-10 的本地後台預覽都曾因受限程序無法連向管理 API，回傳 502／`ADMIN_UPSTREAM_UNAVAILABLE`；Node fetch 的原因為 `EACCES`。以具備外連權限的方式重啟同一份 production build 後，匿名驗證請求恢復為 401。這是已重複發生的啟動環境問題，因此外連權限與 API 連通性列為標準啟動檢查，不等到使用者看到登入錯誤才排查。

1. 新對話首次處理預覽時，先確認既有 3001 程序的來源，並執行下節的本地代理檢查。來源正確且檢查通過時可沿用，不需為了新對話重啟。
2. 需要啟動或重啟時，確認**實際啟動伺服器的工具呼叫**具有所需外連權限。既有程序的權限、上一個對話的執行狀態，或另一次具備權限的連線診斷，都不能證明新程序有相同權限。
3. 在目前 Codex 受限執行環境，管理後台等需要上游 API 的本地預覽，使用工具支援的 `sandbox_permissions: "require_escalated"` 啟動程序，經正常權限審查取得外連能力。它是工具呼叫的設定，不是 PowerShell 命令，也不需要 Windows 系統管理員權限。一般本機終端若已有外連能力，無須額外提升權限；建置也不因這項規則一律提升權限。
4. 啟動後執行下節檢查。若受限程序已回傳 502 且診斷證實 `EACCES`，只停止已確認來自本 checkout 的程序，再以具備外連權限的方式啟動相同產物。僅調整執行權限且原始碼未變時，不必重新建置。
5. 若正常權限審查拒絕啟動，或恢復權限後仍無法連線，保留故障結果並回報，依實際原因繼續排查 API 狀態、設定或網路。502 本身不能證明是 `EACCES`，不得把檢查未通過的預覽交付為可用。

### 3.2 建置、啟動與本地 API 檢查

以下命令在 `ToBeClarify-web` 執行。Windows PowerShell 使用已安裝的 CLI，避開 npm script 的 POSIX 環境變數語法。預設先建置，再於 3001 啟動：

```powershell
$env:WRANGLER_LOG_PATH = '.wrangler/wrangler.log'
node --experimental-strip-types ./node_modules/vinext/dist/cli.js build
if ($LASTEXITCODE -ne 0) { throw '建置失敗，不啟動舊產物作為本次預覽。' }
node --experimental-strip-types ./node_modules/vinext/dist/cli.js start --hostname 127.0.0.1 --port 3001
```

先確認 3001 程序的來源；若需重啟既有預覽，只停止已確認屬於本 checkout 的程序，不停止不明占用者。開啟 [本地建置預覽](http://127.0.0.1:3001/) 並完成下一節檢查；建置成功不等於字型檢查通過。`start` 不提供程式碼熱更新，後續修改需要重新建置及重啟。不得建置失敗後將舊產物當成本次結果。這是本地執行，不會部署至正式站，也不更換 API 設定。

後台預覽在每次啟動／重啟後及交付前，必須從本地 Web 代理執行一次**不帶 Cookie 或登入憑證**的驗證請求。在另一個終端或工具呼叫執行：

```powershell
@'
const response = await fetch('http://127.0.0.1:3001/api/admin/auth/me', {
  redirect: 'manual',
  signal: AbortSignal.timeout(25000),
});
console.log('admin auth/me: HTTP ' + response.status);
process.exitCode = response.status === 401 ? 0 : 1;
'@ | node --input-type=module
if ($LASTEXITCODE -ne 0) { throw '管理 API 連通檢查未通過，請先排查再交付預覽。' }
```

401 在這裡表示上游已處理匿名請求，登入頁才能正常進入登入表單；不是故障，也不代表已驗證登入成功或全部業務端點。502／`ADMIN_UPSTREAM_UNAVAILABLE`、連線失敗、逾時及其他非預期狀態都未通過檢查。必須確認的是 **3001 預覽程序透過代理連到 API**；另一個程序直接呼叫上游成功，以及 `/admin/login` 或 `/api/health` 回傳 200，都不能取代這一步。

這是唯讀 HTTP 可用性檢查，不是自動化測試套件，不需登入帳號，不會部署 Web／API，也不加入 `dev` 發布的自動化測試關卡。

僅於明確要求熱更新或排查時使用 3000：

```powershell
$env:WRANGLER_LOG_PATH = '.wrangler/wrangler.log'
node --experimental-strip-types ./node_modules/vinext/dist/cli.js dev --hostname 127.0.0.1 --port 3000
```

若 3000 缺少字型變數，必須標示不能作為字級／版面基準，回到 3001 建置預覽確認。未特別指定時，交付本機預覽連結一律使用 `127.0.0.1:3001`，不混用 localhost 的登入狀態。

## 4. 開啟後的檢查與交付條件

顧客身份區以緊湊單行顯示名稱、狀態、遊戲 ID 標籤與完整 ID，元素間距為 14px；長內容保留水平捲動，不重疊或省略文字。

顧客身份區以單行依序顯示自訂名稱、放大的可點餐／唯讀狀態、遊戲 ID 標籤及同字級的完整 ID；訂單數獨立移到右側指標。長 ID 與窄畫面的單行表頭保留橫向捲動，不裁去資訊。訂單表頭依序為狀態、單號、應付金額及台灣時間，使用共用 `AdminDisclosureSummary` 的圓框與箭頭。

Flow v2 訂單從既有履約 API 核對分項：每項皆為 completed／cancelled，且完成加取消數量等於購買數量時預設收起；無分項、未知狀態、讀取失敗或仍待接受協調單均預設展開。舊版依 API 訂單狀態預設展開／收起。使用者可手動切換，收起不卸載表單草稿；讀取與收合狀態不改動接待、交易或權限。未完成分項依本次使用者選擇，使用柔和主題底色、左側色條與目前履約狀態標籤，不加閃爍。人工確認全完成、部分取消、未完成、重讀失敗、鍵盤開關及明暗主題後，才能聲稱實際渲染已確認。

顧客摘要右欄依序放點餐管理與顧客服務。點餐管理的左側為標題／人數表單，右側為三個操作按鈕；摘要容器小於 420px 才改為單欄。頂部身份區分為名稱與狀態、遊戲 ID，以及獨立的大字訂單數，確認長名稱與大筆數仍可讀；作品按鈕顯示「建立作品／查看作品」，路由及 query 保留。

### 手機後台版面（2026-10-26）

上述單行顧客身份、訂單表頭與消費紀錄的並列配置保留於桌面；760px 以下改為換行／直式配置，讓完整遊戲 ID、單號、金額、來源單號、原因及時間可見，不再依賴逐列橫向捲動。顧客指標改為直式列，清單與明細之間提供手機快速跳轉。仍保留有界高度的顧客清單與分類收合，不以展開整份長名單取代。

歷史顧客在680px以下以同一張表格的逐筆直式列顯示，欄位名稱由`data-label`提供；桌面維持表格。外層grid使用`minmax(0, 1fr)`，橫向捲動限制於表格容器，不得撐寬查詢表單。其他使用共用表格的頁面維持既有呈現。

手機顧客面板使用自然高度；名單捲動區本身使用`clamp(320px, 50dvh, 520px)`，不參與flex壓縮。不得再限制整張面板為65dvh／520px，否則搜尋、進度說明及快速跳轉按鈕會擠掉名單空間。短螢幕可捲動整頁至名單，再於名單內捲動；清單與明細快速跳轉保持可用。

手機拖曳卡片內容須在扣除把手與間距後縮小；週報日期可換行，店員班次說明獨立一列，公開開關與編輯按鈕留在卡片內。值班規劃摘要須顯示完整起訖日期；開啟手機編輯表單時移到表單並轉移焦點。760px以下工具列隨文件捲動，TOP按鈕位於內容後方，不覆蓋輸入欄位。以上樣式沿用共用主題變數，不改API或交易行為。

以375、390、430px與桌面寬度核對，並留意暗色主題、長ID及大金額。可用`scripts/preview-css/admin-mobile-layout.json`作產物宣告檢查；它不等於瀏覽器或iPhone Safari真機驗收。

使用者自行檢視本地畫面、未明確要求 AI 瀏覽器檢查時，不自動操作瀏覽器。此時完成建置、必要的靜態／HTTP 與 CSS、字型資源輸出檢查後，提供 `http://127.0.0.1:3001/menu` 等受影響頁面，並明確註記 Computed／Rendered Fonts 尚未確認；不得把資源檢查稱為實際渲染驗證。下列瀏覽器檢查步驟在使用者明確要求 AI 檢查時執行。

後台預覽須先通過 [3.2 節的本地 API 檢查](#32-建置啟動與本地-api-檢查)，再確認樣式與字型。若無法連通，依 [3.1 節](#31-新對話與程序的外連權限) 排查實際啟動程序的權限；不得只以 Web 健康端點的 200 判定預覽可用。

1. 本地與參考站使用相同瀏覽器、viewport、縮放比例（建議 100%）、捲動位置及頁面內容。記錄正在比較的網址與執行模式。
2. 在 Network 確認 CSS 和頁面實際需要的字型請求成功，回應內容是 CSS／字型，而非錯誤頁；檢查 Console 的資源與字型錯誤。首次排查可停用快取後重新整理。
3. 在 Elements／Computed 確認 `<body>` 的三個字型變數已定義，字型 CSS 已注入；等待字型載入完成，再比較指定元素的 `font-family`、`font-size`、`font-weight`、`line-height` 與 `letter-spacing`。
4. 在 Rendered Fonts 確認實際使用的字型。Computed 的字型清單、`document.fonts.ready` 或單獨的 `document.fonts.check()` 都不能獨立證明指定字型已被使用。
5. 記錄載入結果與尚存差異後，才把本地頁面交付作 UI 微調基準。缺少必要 CSS／字型時先處理載入問題，不以放大字級、增加粗細或堆疊 `!important` 補償。

首頁可在瀏覽器 Console 執行以下唯讀檢查，取得兩端相同欄位的結果：

```javascript
await document.fonts.ready;
const bodyStyle = getComputedStyle(document.body);
console.table(
  ["--font-geist-sans", "--font-geist-mono", "--font-noto-sans-tc"].map(
    (name) => ({ variable: name, value: bodyStyle.getPropertyValue(name).trim() })
  )
);
console.table(
  [".home-business-status > b > span", ".home-business-status > b small"].map(
    (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, error: "找不到元素" };
      const style = getComputedStyle(element);
      return {
        selector,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
      };
    }
  )
);
console.table(
  [...document.fonts].map(({ family, weight, status }) => ({ family, weight, status }))
);
```

字型分片不需要全部進入 `loaded`；僅要求當前頁面用到的字型與字元正常呈現。這是本地人工診斷步驟，不是新增的自動化測試套件，也不改變 `dev` 發布預設跳過自動化測試的政策。若無法取得瀏覽器 Computed／Rendered Fonts，須標示「僅完成 HTTP／原始碼檢查，實際渲染未確認」。

### CSS 產物檢查標準

資源可用、CSS 宣告已輸出、瀏覽器實際套用是三種不同的檢查結果，必須分開回報。2026-10-09 的側欄檢查曾因壓縮後的屬性排列與原始碼不同而誤報；這是檢查方式的問題，不是建置失敗，不得為了讓檢查通過改動正確的畫面樣式。

- 不以整段 CSS 字串、固定空白或依賴屬性順序的正規表示式判定成功；也不得放寬成「整個檔案有出現值就算通過」。
- 使用 CSS parser 比對完整選擇器、明確的屬性與值，並保留 `@media`／`@supports`／`@layer` 等條件；桌機、手機、明暗主題與偽類不能互相代替。合併選擇器、空白與等價的壓縮表示須經解析／正規化處理。
- 同選擇器、同條件的重複明確屬性依樣式資源與宣告順序處理，保留 `!important`。不能只找到較早的預期宣告就忽略後面的不同值。
- 區分選擇器缺失、條件缺失、明確宣告缺失、值不符，以及取得／解析／設定錯誤。遇到 shorthand、巢狀選擇器、變數解析或其他無法證明的情境，查核原始碼及 Computed；不得直接宣稱畫面失敗，也不能刪除預期條件來湊通過。
- URL 模式從當次 HTML 讀取 stylesheet links，依 HTML 順序檢查，不寫死 hash、不排序 bundle 檔名、不使用別的版本產物。

可重用工具：[scripts/check-preview-css.mjs](../scripts/check-preview-css.mjs)。它使用既有建置依賴的 PostCSS／Lightning CSS，無須新增套件。以下是目前側欄分類與品牌配置的檢查範例，在 `ToBeClarify-web` 執行：

```powershell
node scripts/check-preview-css.mjs --url http://127.0.0.1:3001/admin/staff --expect scripts/preview-css/admin-navigation.json
if ($LASTEXITCODE -ne 0) { throw 'CSS 產物檢查未通過；請依輸出的分類排查，不等同建置失敗。' }
```

`--expect` 指向 JSON 陣列，每筆使用 `selector`、`declarations` 與選用的 `context`（由外至內排列的 at-rule 字串陣列；省略表示頂層）。值可以包含 `!important`。範例見 [admin-navigation.json](../scripts/preview-css/admin-navigation.json)；此檔只描述該次側欄設計，不是全站視覺快照，需求變更時同步調整。也可用一個以上 `--css <路徑>` 取代 `--url`，路徑順序須與實際載入相同。

結束碼 `0` 表示所有明確宣告符合、`1` 表示預期宣告未符合、`2` 表示輸入、資源或解析問題。工具只檢查外部 CSS 中的明確宣告，不展開 shorthand、不計算其他選擇器的 specificity／完整 cascade、不驗證 viewport 是否滿足條件，也不解析 `var()` 或確認 inline／CSS-in-JS／字型樣式。尚有 `@import` 的產物拒絕檢查；巢狀 style rule 不列入比對。這些限制需要人工查核，不能把 `0` 稱為完整 UI 驗收。

這是按需執行的靜態／HTTP 診斷工具，不會啟動瀏覽器、自動建置或部署，不加入 build／dev 部署的自動測試關卡。工具本身改動時，應確認格式等價的輸入通過，錯值、錯條件及後續覆寫仍會報告不符；可手動執行 `node --test scripts/check-preview-css.test.mjs`，只檢查工具自身與模擬 HTTP 回應，不執行應用／瀏覽器流程，也不加入 dev 發布預設步驟。若只改檢查工具與文件、不改應用產物，無須重建或重啟現有 UI 預覽。

## 5. 本次問題的紀錄與排查原則

2026-09-29 比對本地與正式站時，首頁狀態標籤的相關 CSS 規則相同；正式站 HTML 有字型 CSS 與變數宣告，本地 `vinext dev` 的 HTML 缺少該段。字型檔可回應並不代表瀏覽器已套用它。本次觀察不能推論所有 Vinext 開發模式都一定失敗，後續仍須檢查當次實際輸出。

[40-refinements.css](../styles/public/layers/40-refinements.css) 的當時設定為：

| 元素 | CSS 設定基準 | 排查重點 |
| --- | --- | --- |
| 狀態文字（如「休息中」） | `.home-business-status > b > span`：`13px`、`line-height: 1.15` | 字型繼承自 body，粗細沿父層繼承；用 Computed 及 Rendered Fonts 比對 |
| `LIVE STATUS` | `.home-business-status > b small`：`font: 700 6px/1 var(--font-geist-mono), monospace` | 需有有效的字型變數，確認實際為 `6px`、`700` 與預期字型 |

`var(--font-geist-mono)` 未定義且沒有 `var()` 內建 fallback 時，整條 `font` shorthand 會在計算階段失效，字級、粗細也可能隨之改變；逗號後面的 `monospace` 不能補救缺失的變數。同理，body 的 `var(--font-noto-sans-tc)` 缺失可能使整條 `font-family` 宣告失效，不能保證會使用後面的系統字型清單。

因此排查順序是：確認 checkout／3001 建置程序 → 核對入口與匯入順序 → 核對字型變數和載入 → 比對 Computed／Rendered Fonts。只有取得新的設計需求時才調整上述字級，並同步更新此基準。
