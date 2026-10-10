# 指名人員工作台：三版設計稿

日期：2026-10-10。範圍是 RP 店營業時的指名人員 SOP。設計稿在本機提供範例資料與互動，不串接交易，也未部署到 dev 或正式環境。

## 預覽與版面比較

| 版本 | 本地預覽 | 資訊排列 | 適合比較的重點 |
| --- | --- | --- | --- |
| 01 待辦優先 | [開啟](http://127.0.0.1:3001/admin/preview/designated?view=tasks) | 第一列：等待我確認／目前服務與下一段安排；第二列：顧客處理／今日排程 | 快速確認、拒絕承接；新需求容易被看見 |
| 02 顧客並排 | [開啟](http://127.0.0.1:3001/admin/preview/designated?view=customers) | 左側顧客清單、右側顧客處理；下方橫向今日排程 | 選定顧客後，同一處處理服務、餐點、包廂、委託與離店 |
| 03 服務優先 | [開啟](http://127.0.0.1:3001/admin/preview/designated?view=service) | 第一列：目前服務、剩餘時間與下一段安排／今日排程；第二列：等待我確認／顧客處理 | 正在服務時，時間與接續安排最清楚 |

三版可在頁面上方直接切換，切換時保留範例操作結果，便於比較同一狀態。重新整理或按「重設範例資料」會還原範例。頁面可切換深淺主題。

## 共同納入的營業 SOP

- 指名確認：顧客直接指名與經理轉單沿用同一個確認承接步驟。無法承接須填原因，交回經理協調；保留整張顧客訂單。沒有既有指名 A 改派 B 的操作。
- 服務：開始、完成、加點與續約指名。續約表單示意新增指名需求，不修改原服務時長；範例剩餘時間固定依 22:24 呈現。
- 顧客現場需求：重發本次點餐碼、代點餐點、代訂包廂。包廂以現有代客訂購步驟為範圍，表單、品項與價格在稿中皆為示意。
- 委託：建立繪圖／簽繪需求，產生初始領取碼與可複製的顧客訊息，明確標示尚未開放領取。營業中不處理作品製作、上傳或後續交付。
- 離店：結束目前服務後，可標記顧客離店、關閉點餐；需要時重新開放點餐。異常與調整預設收合。
- 個人當班狀態：簡短出勤資訊、上／下班打卡、暫停／恢復新指名、營業通知。

跨日 CRM、薪資與個人帳目、實收／實退與回款、留言板、未來排班、個人設定與包廂協作不放入本次畫面。回款仍保留為之後三種工作台的共同規劃。

## CSS 與間距依據

頁面使用原有 admin layout、字型注入與完整 `styles/admin/site.css`，沿用 `AdminPage`、`AdminPanel`、`AdminButton`、`AdminField`、`AdminToggle`、`AdminDialog` 與 `AdminDisclosureSummary`。外側欄位使用相同 shell class，新增版面樣式限制在 `.adminDesignatedPreview` 和 `.adminDesignatedPreviewDialog`。

- 區塊及相鄰面板：使用 `--admin-space-block`、`--admin-space-inline`，均為 18px；子面板外距歸零，避免重複留白。
- 頁面標題：沿用 32px、1.2 行高、原有 eyebrow 與說明間距。
- 字型：沿用 Geist、Geist Mono 與 Noto Sans TC，不另外指定替代字型修補尺寸。
- 控制項：保留原按鈕、欄位、dialog 與明暗主題；純圖示按鈕沿用 `iconActionButton`。
- 手機：原側欄收合，資訊欄改為單欄，顧客及橫向排程依寬度換列；整頁使用原生捲動。

依據：[後台設計規範](admin-ui-design-guidelines.md)、[本地預覽規範](local-ui-preview.md)、[圖示按鈕規範](icon-action-design-standard.md)。

## 驗證與限制

使用 `ToBeClarify-web` checkout 的 production build，建置成功，預覽位址為 `http://127.0.0.1:3001`。TypeScript 檢查通過；新檔 lint 通過，全專案 lint 無錯誤、27 個既有圖片警告。未執行自動化測試套件。

三個版本的本地 HTTP 均回應 200；以既有 PostCSS／LightningCSS 診斷解析三份 CSS 產物，10／10 項宣告符合（含 18px token、32px 標題、零重複外距及手機單欄條件）。HTML 字型注入包含三個預期變數、119 個 font-face 規則，116 份字型檔均可取得。這些結果確認原始產物與資源存在，不代表實際字型使用或畫面已驗收。

正式頁面與本地預覽的 Browser 工具均回報 saved browser permissions 無法驗證，不能讀取實際畫面，因此不以其他瀏覽器控制方式繞過限制。

**僅完成 HTTP／原始碼檢查，實際渲染未確認。** CSS 產物與字型資源檢查不等於 computed styles、Rendered Fonts、桌機／手機畫面或 dialog 互動驗收；實際留白仍需在可存取的預覽畫面確認。

## 原始碼

- [路由入口](../app/admin/preview/designated/page.tsx)
- [三版設計與範例狀態](../features/admin/designated-preview/DesignatedPreview.tsx)
- [共用營業面板](../features/admin/designated-preview/PreviewPanels.tsx)
- [工作台內操作視窗](../features/admin/designated-preview/PreviewActionDialog.tsx)
- [範例資料與狀態](../features/admin/designated-preview/preview-data.ts)
- [作用域限定的設計樣式](../styles/admin/designated-preview.css)
