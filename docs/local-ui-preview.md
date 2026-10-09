# 本地 UI 預覽：CSS 與字型載入標準

更新日期：2026-10-09。適用於 `ToBeClarify-web` 的本地公開站、點餐入口及管理後台。每次啟動、重啟、切換分支或更換建置模式後，須依本文件確認樣式與字型，再將畫面作為 UI 調整基準。

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
@import "../shared/select.css";
@import "../shared/icon-actions.css";
```

只保留入口匯入，不把這段另貼到頁面重複載入。實際順序以目前分支的入口檔為準；新增或調整入口時同步更新本文件，不得漏載後段覆寫，也不得因檔名包含 `history` 就跳過。

### 公開頁面大區塊留白

`70-section-spacing.css` 統一公開頁面的主要區段間距，沿用已確認的首頁基準：桌機上下各 `clamp(30px, 4vw, 62px)`；820px 以下上 34px、下 58px。共用變數為 `--public-section-space-start` 與 `--public-section-space-end`，新增公開頁面時將主要區段加入該檔的明確 selector 清單。

適用首頁、店員名單、活動相簿、菜單、包廂、即時動態、排行榜、留言牆／分享頁及作品領取頁；店員個人頁調整頁面外圍留白並保留工具列空間。頁首、頁尾、搜尋列、跑馬燈、卡片內距、相片燈箱及點餐嵌入面板不套用大區塊間距。頁首沿用既有高度，頁尾上下各 14px。

| 頁面範圍 | 額外樣式入口 | 載入規則 |
| --- | --- | --- |
| 公開站 | 無 | 根 layout 的公開樣式已包含首頁狀態標籤 |
| `/admin` | [styles/admin/site.css](../styles/admin/site.css) | 由後台 layout 載入，保留入口內所有 `@import` 的順序 |
| `/order` 及點餐預覽 | [styles/ordering/site.css](../styles/ordering/site.css) | 由相應頁面載入，順序為 `base.css` → `modern.css` |

後台與點餐仍繼承根 layout 的公開樣式及字型設定，不是完全獨立的 CSS 作用域。

後台入口包含 `95-scrollbars.css`，統一整頁、側欄、抽屜與內部清單的捲軸明暗配色。根層規則以 `:root:has(.adminTheme)` 限定後台範圍，預覽時確認離開後台後公開頁面不受影響；側欄使用內縮的 `.adminTopbarScroll`，捲軸不得碰到外層圓角邊框。設計基準見[後台 UI 設計規範](admin-ui-design-guidelines.md)。

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

以下命令在 `ToBeClarify-web` 執行。Windows PowerShell 使用已安裝的 CLI，避開 npm script 的 POSIX 環境變數語法。預設先建置，再於 3001 啟動：

```powershell
$env:WRANGLER_LOG_PATH = '.wrangler/wrangler.log'
node --experimental-strip-types ./node_modules/vinext/dist/cli.js build
if ($LASTEXITCODE -ne 0) { throw '建置失敗，不啟動舊產物作為本次預覽。' }
node --experimental-strip-types ./node_modules/vinext/dist/cli.js start --hostname 127.0.0.1 --port 3001
```

先確認 3001 程序的來源；若需重啟既有預覽，只停止已確認屬於本 checkout 的程序，不停止不明占用者。開啟 [本地建置預覽](http://127.0.0.1:3001/) 並完成下一節檢查；建置成功不等於字型檢查通過。`start` 不提供程式碼熱更新，後續修改需要重新建置及重啟。不得建置失敗後將舊產物當成本次結果。這是本地執行，不會部署至正式站，也不更換 API 設定。

僅於明確要求熱更新或排查時使用 3000：

```powershell
$env:WRANGLER_LOG_PATH = '.wrangler/wrangler.log'
node --experimental-strip-types ./node_modules/vinext/dist/cli.js dev --hostname 127.0.0.1 --port 3000
```

若 3000 缺少字型變數，必須標示不能作為字級／版面基準，回到 3001 建置預覽確認。未特別指定時，交付本機預覽連結一律使用 `127.0.0.1:3001`，不混用 localhost 的登入狀態。

## 4. 開啟後的檢查與交付條件

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
