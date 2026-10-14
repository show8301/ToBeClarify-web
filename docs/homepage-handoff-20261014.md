# 首頁改版交接：2026-10-14

## 接續位置與狀態

- 正式維護儲存庫：`show8301/ToBeClarify-web`。
- App 主要資料夾：`I:\Codex\Projects\ChatGPT\RP店-清醒夢\ToBeClarify-web`。
- 本批工作分支：`codex/homepage-layout-20261014`。
- 分支基底：`25f95b01e38cbf7976eefac2ad179113a40ee115`；整理時與本機 `origin/dev` 相同。新對話須重新確認遠端及工作區狀態，不能推論遠端一直未變。
- 本次先將退休工作樹中已做的首頁需求移植到新版 Web，再整理為本地提交。完整提交 SHA、差異檔 SHA256 與驗證結果見 [交接清單](I:/Codex/ProjectBackups/RP店-清醒夢/20261014-dbbf-sync/homepage-handoff/manifest.json)。
- 尚未推送、建立 PR 或部署；新版分支尚未完成瀏覽器畫面、字型與點擊流程驗收。
- 此次只涉及 Web 首頁；API、藍圖站與環境設定沒有修改。

新對話從上列 Web checkout 開始，先讀當下的 [AGENTS.md](../AGENTS.md)、[程式編寫規則](coding-standards.md) 及 [本地預覽標準](local-ui-preview.md)。本交接文件記錄工作狀態與使用者需求，不另複製或取代這些維護規範。

## 使用者的最終需求與目前實作

後續更正優先於最初的瀏覽器標記。

| 項目 | 最終要求 | 新版分支的處理 |
| --- | --- | --- |
| 關於區照片 | 橫版，**左圖右文**；使用者已撤回「圖片放右側」 | 照片置於 DOM 第一個區塊；圖像 16:10；桌機兩欄，820px 以下圖片在上、文字在下 |
| 相框 | 必須調查既有相框是否能匹配 | 沿用首頁 `.home-about-photo` 膠帶相框、底部 `PLACE / 001` 標籤與既有主題；增加 landscape modifier，不引入另一套相框 |
| 關於區標題 | 放在說明文字上方 | 同一右側 `.home-about-content` 中，標題在前、段落在後 |
| 關於區重複資料 | 移除 OPEN／WHERE 資訊列 | 刪除該列，保留原有說明段落；不修改來源資料 |
| 伺服器／地址卡 | **恢復原本樣式，只額外放大 6 號**；撤回兩欄重排及新增中文欄名 | 保留 SERVER／ADDRESS 的原有兩列配置；只將欄位值 `<b>` 的 15px 改為 21px，其他欄名與 LD 標記維持原樣 |
| Hero 按鈕 | MEET THE DREAMERS 文字置中、放大 | 標籤包入 span、字級 14px、最小高度 60px；文字置中，既有箭頭保留在右側 |
| 結尾店員按鈕 | 文字置中、取消箭頭 | 保留「店員一覽」與 `/staff`，移除箭頭，置中 |
| 結尾菜單按鈕 | 移除「佳餚名錄」 | 只刪除首頁結尾該按鈕，不刪導覽選單或 `/menu` 路由 |
| LD 隱藏入口 | 點五次前往後台登入 | 新版基底已具備 `openAdminAfterFiveClicks`，原封保留；須在新預覽實際確認前四次不跳轉、第五次前往 `/admin/login` |
| 大區塊間距 | 查明為何與正式站不同，避免額外修改間距 | 新版已由 `70-section-spacing.css` 統一留白，本批沒有新增或修改該規則、頁首或頁尾；保留既有桌機／手機間距 |
| CSS／字型 | 排查本地預覽缺少載入，遵守最新規範 | 沿用新版公開 CSS 分層與根 layout 字型設定；沒有套用舊 globals.css、舊 README 的 3000 流程或舊 package.json |

相框調查：目前可用的是首頁的原生 JSX＋CSS 膠帶相框。另一組 `.main-polaroid` 在 `features/staff/components/StaffProfile.tsx` 中，綁定店員照片與 lightbox 互動，並非通用橫版 Frame 元件；本批沒有跨 feature 引用該實作。既有 `is-image-loaded`、懶載入、onLoad/onError、減少動態效果等行為仍保留。

新版 HomeLanding 已有即時店舖資料、輪播時間設定、消費規則刷新及 `livePageVisibility`。本次僅改必要 JSX 與 CSS，沒有用舊版整個元件覆蓋新版；店員按鈕仍受原有 staff 顯示旗標控制。

## 修改檔案與不應再次套用的舊差異

目前整批修改集中在：

1. [HomeLanding.tsx](../features/home/components/HomeLanding.tsx)：左圖右文、段落標題組合、移除重複列、按鈕文字與箭頭。
2. [10-page-layouts.css](../styles/public/layers/10-page-layouts.css)：關於區雙欄／單欄、橫版相框、地址欄位值字級。
3. [40-refinements.css](../styles/public/layers/40-refinements.css)：Hero 按鈕字級與置中、結尾按鈕置中。
4. 本交接文件。

`styles/public/site.css` 的入口順序保持原樣，包含 00／10／20／30／40／50／60／70／80 與 shared select、icon-actions。`app/layout.tsx` 的 Geist、Geist Mono、Noto Sans TC 注入保持原樣。移植沒有改 `package.json`、lockfile、API 契約或發布工作流程。

退休儲存庫 `silverfantacy/LUCID-DREAM` 的原始差異保存在交接包內，只供追溯。**不得把其整包 patch 套到新版**：它的 `app/HomeLanding.tsx`、單體 `app/globals.css`、舊套件 script 與 README 預覽位置，均已不符合新版架構。新版可用差異是 `active-homepage.patch`，不是 `legacy-all-changes.patch`。

## 驗證記錄與待驗收項目

已完成的新版驗證，紀錄保存在交接包的 `validation/`：

- Vinext production build：通過，exit 0。
- TypeScript `--noEmit`：通過，exit 0。
- ESLint：exit 0，0 errors／26 warnings，包含現有 `<img>` 最佳化提示；沒有為清除警告改寫其他功能。
- `git diff --check`：通過。
- 原始碼差異檢閱：LD 入口、資料刷新、pageVisibility、圖片載入與 shared spacing 均保留。

尚未啟動新版分支預覽，沒有執行自動化測試套件，也未將舊截圖視為新分支的畫面驗收。交接包 `historical-screenshots/` 是舊工作樹的歷史參考，不能證明新版字型、像素、間距或點擊流程已通過。

新對話的驗收順序：

1. 確認 Web Git root、分支及提交；保留任何新增的未提交變更。若使用新 worktree，必須明確從 `codex/homepage-layout-20261014` 開始，預設 main 快照不包含這批未上板的分支。
2. 依 `docs/local-ui-preview.md` 在 **127.0.0.1:3001 production build** 啟動；先核對占用程序來源及所需外連權限，不沿用來源不明的舊 3000 程序。
3. 確認 CSS 的所有分層匯入、字型變數與 font-face 有輸出，不能只以 HTTP 200 或字型 class 判定套用成功。後台預覽交付另須確認匿名 `/api/admin/auth/me` 為 401。
4. 使用者確認桌機 1613／1864 與手機 390／320 的首頁。檢查左圖右文、標題位置、相框／裁切、地址兩列＋21px、兩個店員入口、重複資訊／菜單按鈕移除、各區留白。AI 操作瀏覽器依當下使用者授權及預覽規範執行。
5. 核對 Computed／Rendered Fonts 與 LD 五次點擊。如果未做瀏覽器檢查，須明確回報未確認，不能把 build 或舊截圖稱為已完成畫面驗收。
6. 有新的程式修改時重新建置／重啟；只有文件更新不必重複應用程式建置。

## I 槽、備份與發布順序

所有交接包、截圖、檢查紀錄、快取與建置輸出都在 I 槽：

- [交接包](I:/Codex/ProjectBackups/RP店-清醒夢/20261014-dbbf-sync/homepage-handoff/manifest.json)。
- [專案同步紀錄](I:/Codex/ProjectBackups/RP店-清醒夢/20261014-dbbf-sync/manifest.json)。該紀錄的 Web source SHA 是遷移時的基底，現在首頁分支的新提交是其後續修改，並非同步失敗。
- npm cache：`I:\Codex\Caches\npm`。
- TEMP／TMP：`I:\Codex\ProjectBackups\RP店-清醒夢\20261014-dbbf-sync\tmp`。
- API 保留在 `I:\Codex\Projects\ChatGPT\RP店-清醒夢\ToBeClarify-api`；本批不修改或發布 API。

Windows PowerShell 以 README／local-ui-preview 的 CLI 等效方式執行；本機可用 Node runtime 是 `C:\Users\Nick-win10\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`，只讀取該既有 runtime，不往 C 槽安裝依賴。空間不足時依使用者指示暫停，重啟後再續作。

先完成本地畫面確認，再將同批修改整理到 Web `dev`，依當下遠端狀態處理分支／合併並發布 `https://www-dev.marchgroup.net`。不要用本地提交或 build 成功代替使用者畫面確認。dev 發布預設不執行自動化測試套件，依最新 AGENTS 做建置、靜態與操作性 HTTP 檢查。正式 `main` 須等使用者確認 dev 版本後，依 `dev` → `main` 手動 PR 流程推進。本文件不授權跳過該確認。

## 新對話可直接貼上的訊息

```text
請接續本次首頁改版與上板準備。主要專案是 I:\Codex\Projects\ChatGPT\RP店-清醒夢\ToBeClarify-web，工作分支 codex/homepage-layout-20261014。

先讀當下 AGENTS.md、docs/coding-standards.md、docs/local-ui-preview.md，以及 docs/homepage-handoff-20261014.md；核對實際 Git root、分支、提交與未提交變更。本批已移植到新版並做本地提交，不要再把退休 LUCID-DREAM 的整包 patch 套入新版。

請先準備 127.0.0.1:3001 的 production build 首頁給我確認，依交接清單確認 CSS／字型與首頁改動。確認後再接續 Web dev 上板；正式 main 仍等我確認 dev 版本後依專案流程處理。此次只有首頁 Web 改動，不發布 API。所有暫存與建置留在 I 槽，空間不足先暫停。
```
