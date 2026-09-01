# ToBeClarify Web

清醒夢的公開網站、顧客點餐入口與管理後台。專案使用 React 19、Vinext App Router 與 Vite；正式執行需要 Node.js，不是純靜態網站。

## 本機開發

需求：Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

常用檢查：

```bash
npm run build
npm run lint
npm run test:non-e2e
```

## 目錄

- `app/`：頁面與 API 路由入口；不要在這裡堆放大型功能元件。
- `features/`：依產品功能分類的畫面、client API、server data 與型別。
- `components/`：跨功能共用的版面及媒體元件。
- `lib/server/`：只在伺服器端使用的共用設定。
- `data/snapshots/`：公開頁面的容錯首屏快照。
- `styles/`：公開站、後台與點餐入口各自的樣式入口及 cascade layers。
- `public/`：網站實際使用的靜態素材。
- `scripts/`、`deploy/`：IIS/Vinext 部署與維運腳本。
- `tests/`：伺服器渲染、API client、UI 契約與部署腳本測試。

完整邊界與新增檔案規則請見 [`docs/architecture.md`](docs/architecture.md)。IIS 部署說明請見 [`docs/iis-dev-deployment.md`](docs/iis-dev-deployment.md)。

## 分支與部署

- 功能分支先合併到 `dev`，由 GitHub Actions 部署到測試站。
- 測試站確認完成後，才由 `dev` 發 PR 到 `main`。
- `main` 是正式發布來源，不應直接拿來測試未確認變更。

部署環境透過 repository variables 提供路徑、health check 與可選的 API base URL；本機對應鍵值列在 [`.env.example`](.env.example)。
