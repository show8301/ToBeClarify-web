# ToBeClarify Web

清醒夢的公開網站、顧客點餐入口與管理後台。專案使用 React 19、Vinext App Router 與 Vite；正式執行需要 Node.js，不是純靜態網站。

## 本機開發

需求：Node.js `>=22.13.0`。使用 npm 與已提交的 `package-lock.json`。

Linux／具 POSIX shell 的環境：

```bash
npm ci
npm run dev
```

Windows PowerShell：目前 npm 啟動／建置 script 使用 POSIX 環境變數語法，改以以下等效方式呼叫已安裝的 Vinext。

```powershell
npm ci
$env:WRANGLER_LOG_PATH = '.wrangler/wrangler.log'
npx --no-install vinext dev
```

程式碼修改的靜態檢查與建置（純文件修改只需核對文件及差異）：

```bash
npm run build
npm run typecheck
npm run lint
```

PowerShell 的等效建置方式如下；`typecheck` 與 `lint` 可直接使用上述 npm 指令。

```powershell
$env:WRANGLER_LOG_PATH = '.wrangler/wrangler.log'
node --experimental-strip-types ./node_modules/vinext/dist/cli.js build
```

`npm run test:non-e2e` 保留供明確要求／適用的 PR 或正式驗證使用；它不是 dev 發布的預設步驟。`npm test` 包含建置及自動化測試，也不應用於預設 dev 發布。完整執行條件見[程式編寫規則](docs/coding-standards.md)。

## 開發規範

- [程式編寫規則](docs/coding-standards.md)：開發前閱讀，涵蓋型別、目錄、API、權限、互動、樣式與發布。
- [2026-09-12 盤點紀錄](docs/coding-standards-audit-20260912.md)：現況、規則差異與尚未完成的整理項目。
- [架構說明](docs/architecture.md)：執行方式、模組責任與資料流。

## 目錄

- `app/`：頁面與 API 路由入口；不要在這裡堆放大型功能元件。
- `features/`：依產品功能分類的畫面、client API、server data 與型別。
- `components/`：跨功能共用的版面及媒體元件。
- `lib/server/`：只在伺服器端使用的共用設定。
- `data/snapshots/`：公開頁面的容錯首屏快照。
- `styles/`：公開站、後台與點餐入口各自的樣式入口及依順序載入的 CSS 檔。
- `public/`：網站實際使用的靜態素材。
- `scripts/`、`deploy/`：IIS/Vinext 部署與維運腳本。
- `tests/`：伺服器渲染、API client、UI 契約與部署腳本測試。

新增檔案與依賴規則請見[程式編寫規則](docs/coding-standards.md)。IIS 部署操作請見[部署說明](docs/iis-dev-deployment.md)。

## 分支與部署

- 功能分支先合併到 `dev`，由 GitHub Actions 部署到測試站。
- `dev` 發布前、中、後預設跳過所有自動化測試，僅做建置、靜態／設定檢查、部署狀態與 HTTP 可用性檢查；除非使用者明確要求該次測試。
- 記錄測試站的 dev commit SHA，使用者明確確認該版運作正常後，才由 `dev` 發 PR 到 `main`；PR 必須包含同一個已驗收提交，再人工合併。
- `main` 是正式發布來源，不應直接拿來測試未確認變更。

API 沒有獨立測試主機。整體需求要求 Web／API 一起部署至測試環境時，Web 進 `dev`，API 依自己的正常正式流程進 `main`；API `dev` 僅做 build／artifact 驗證。

部署環境透過 repository variables 提供路徑、health check 與可選的 API base URL；本機對應鍵值列在 [`.env.example`](.env.example)。
