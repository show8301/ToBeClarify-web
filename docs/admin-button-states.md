# 後台按鈕狀態標準

2026-10-14。適用後台文字、圖示及原生按鈕；不改變 API 的權限、交易資格或資料狀態。

| 狀態 | 畫面與行為 |
| --- | --- |
| 可操作 | 手型游標；保留原來的按鈕文字與樣式 |
| 不可操作 | 禁止游標與淡化；必要時在旁邊說明缺少的條件 |
| 處理中 | 禁止重複點擊；以明確的處理文字或進度圖示表示，不因 `disabled` 自動推定載入中 |

## 共用介面

[AdminButton](../features/admin/shared/AdminButton.tsx) 為 TSX 共用元件；原有 `AdminShared.jsx` 的匯出路徑仍可使用。

```tsx
<AdminButton disabled={!canSave} disabledReason="請先填寫作品名稱。">儲存</AdminButton>
<AdminButton busy={savingThisAction} busyLabel="儲存中…">儲存</AdminButton>
```

- `disabled` 僅控制可操作性，不產生轉圈圖示。
- `busy` 或按鈕自身明確的 `aria-busy=true` 會顯示進度圖示、設定 `aria-busy` 並停用按鈕；可以用 `busyLabel` 提供文字。
- `disabledReason` 在不可操作時提供原生 title。關鍵條件不能只靠 title，需像正式結算一樣顯示可讀說明並用 `aria-describedby` 關聯。
- 若全頁有其他請求進行中，其他按鈕只使用 `disabled`。只有實際執行的操作使用 `busy`；不得把共用 `saving` 值無差別套成所有按鈕的進度。
- 沒有接入 `busy` 的既有流程，仍可沿用原本「儲存中／送出中」文字；不能從單純停用、權限不足或資料未填推導進度。
- 進度圖示尊重 `prefers-reduced-motion`；停用按鈕保留游標命中，沒有使用 `pointer-events: none` 隱藏禁止提示。

[AdminRefreshButton](../features/admin/shared/AdminRefreshButton.tsx) 使用明確的 `loading`。例如 `loading={loading}` 與 `disabled={loading || saving}`：載入時顯示重整中，其他儲存操作使按鈕停用時不會誤顯示轉圈。

## 共用 CSS 與既有控制

[80-controls.css](../styles/admin/layers/80-controls.css) 集中處理 `.adminTheme` 下的原生 disabled 按鈕、`aria-disabled`／`data-disabled` 控制，以及共用按鈕、圖片選擇 label 和圖片縮放控制。

舊登入按鈕、共用按鈕、結算步驟、作品交付的範圍／頁籤／佇列規則保留原本的幾何與外觀設定，移除彼此不一致的 cursor 宣告。通知中心及留言板原有正確的禁止游標規則保持相同語意。原生分項履約及作品交付狀態按鈕也受共用規則涵蓋。

## 已接入明確進度的流程

- 13 個後台重整控制：營運總覽、工作台、顧客、作品交付、值班、留言、點單、通知訂單、包廂及結算頁面。
- 結算的關店、保存輸入、重新計算、正式結算及重開時段，依操作名稱追蹤實際執行項目；其他按鈕不會跟著顯示進度。
- 分項履約的接待預覽、正式操作與不確定結果重試，分別追蹤操作，保留原 `operationId`、版本檢查與重試 payload。
- 工作台點餐、加購、服務處理、建立作品及作品開放領取／記錄通知確認。

## 正式結算原因

[disabled-reasons.ts](../features/admin/settlement/disabled-reasons.ts) 只解釋原本的前端及 API 停用條件。資格不足、正在處理、未保存輸入、已結算、存在結算異常、尚未開店、尚未關店及 API 仍不允許結算，都有明確文字。

`canFinalize` 的既有判斷保持不變。API 沒有把待確認帳款或「尚未點過計算預覽」設為額外禁用條件時，前端不自行新增這些門檻；最終結算仍由 API 驗證。

## 本機預覽與驗證

本機 production build 的 [控制狀態預覽](http://127.0.0.1:3001/admin/preview/controls) 使用模擬狀態，不建立訂單、結算或資料異動。實際結算頁可在登入後確認具體原因。

原始 JSX 模組只局部接入新 props 或 re-export；共用按鈕的新實作放在 TSX，不將其餘 dialog、圖片、拖曳或營運邏輯一起遷移。

本次保持本機迭代，未發布 Web／API；依 [本地預覽流程](local-ui-preview.md) 完成 build、型別／lint、CSS selector／declaration 解析、字型資源及匿名管理代理檢查。Computed、Rendered Fonts 與實際 hover 尚未由瀏覽器確認。
