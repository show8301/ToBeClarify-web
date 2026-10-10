# 指名人員工作台：待辦優先實作

2026-10-10。依使用者選定的設計稿 1，將 `/admin` 的指名人員視角換成營業中的操作工作台。此版本為本地未發布實作。

## 本地入口與版面

- 真實工作台：`http://127.0.0.1:3001/admin?workbench=designated`。使用既有登入與角色可用性檢查；網址參數不增加權限。
- 原設計稿：`http://127.0.0.1:3001/admin/preview/designated?view=tasks`。仍使用明確標示的範例資料，不建立交易。
- 第一列：等待我確認、目前服務、下一位顧客。
- 第二列：顧客現場處理、我的今日排程。
- 保留既有後台 shell、AdminPanel、AdminButton、AdminDialog 與字型。區塊／欄間距均使用既有 18px token；小螢幕改為單欄。

## 接入的營業 SOP

| 流程 | 工作台行為 |
| --- | --- |
| 指名承接 | 本人確認承接；無法承接需填原因，交回經理協調 |
| 加購確認 | 在待辦區確認自己的附掛加購，並開始／完成加購服務 |
| 服務進度 | 依自己的履約項目顯示狀態、剩餘時間、預留休息；開始服務先預覽完整購買時間及影響的排程 |
| 例外處理 | 排程項目內折疊改期、取消未服務項目、補登、保留／跨期；舊版服務可依既有規則縮短 |
| 代客訂購 | 工作台彈出表單，取得正式報價後確認；餐點、既有包廂流程、自己的續時分別處理 |
| 點餐碼 | 確認重發後，當場顯示新連結、恢復碼及分享文字；舊資料失效 |
| 委託 | 以目前入場紀錄及訂單建立自己的委託，立即提供初始領取碼、領取連結及分享文字 |
| 離店 | 留存訂單、停止顧客點餐；已離店顧客可在工作台重新開放點餐 |
| 出勤與接單 | 精簡的上下班打卡、暫停／恢復新指名；不顯示個人薪資或工時計算 |

資料範圍是本次營業與自己有關的顧客／訂單。跨期轉入本營業期的服務仍會出現；不透過 UID 歸戶帶入其他跨日歷史。來源入場紀錄屬於已結束營業期時，代點餐／續時／重發碼會停用，由現場另核對本期入場資料。

包廂協作及訂購流程重設、作品製作／上傳／開放領取、回款與實收實退、個人帳目、值班規劃及開店前設定不在本次工作台內。

## 承接請求與經理協調

- 經理視角新增「指名承接協調」，由經理建立新請求，仍走原菜單、報價、時段與指名確認流程。
- 請求以 `isManagerTransfer` 表示來源。API 拒絕顧客及非經理帳號使用；新請求記錄 `manager_transfer` 歷史，既有指名人員不會被改派。
- 新回應端點：`POST /api/admin/orders/{orderId}/nominees/{nomineeId}/response`。即使帳號為經理／開發者，也必須是該筆指名的本人才能以承接者身分回應。
- 拒絕將該筆指名／履約狀態設為 `needs_coordination`。訂單仍有其他服務時保留服務中／部分確認的聚合狀態，否則顯示 `needs_reschedule`。數量、餐點、金額與折抵不變；不呼叫取消整單或退款。
- 退回後，指名人員不能自行重新承接或開始；經理重新協調時間後才再次等待確認。
- 舊版等待確認自動失效排除已退回經理的訂單，避免後續排程清理使整單失效。
- 本人資料端點：`GET /api/admin/designated-order-sessions?businessDate=...`。依本人目前營業參與及本期履約取得入場紀錄，不以顧客歷史擴大範圍。

## 舊版訂單與失敗處理

Flow v2 依服務項目的 API 授權與版本操作，不能以整單已進行中的狀態推斷自己的服務已開始。Flow v1 的指名回應沿用原確認邏輯並補上退回；只有獨立、單一指名的舊版訂單提供整單開始／完成／取消，混合訂單顯示經理核對提示。舊版改期仍會重新等待整單各指名的確認，經理表單明確提示此差異。

訂單與履約請求失敗不切換成模擬成功。讀取失敗會顯示錯誤並停用服務操作；30 秒更新營業資料，倒數每 10 秒更新。切換日期／身分與非同步請求有過期結果及取消處理。

載入中、讀取失敗與正常空資料分開呈現。營業資料或履約讀取失敗時，待辦、服務進度、顧客、下一位及排程不再停留在「讀取中」，待辦數量以「—」表示尚無法確認。本人資料端點回傳 404 時，顯示資料服務尚未就緒及需確認系統更新的提示；API 發布前不能據此判定沒有待辦或顧客。

Flow v2 操作保留原 operation ID／版本以查回不確定的結果。代客訂單重試保留原 quote token 與內容；加購建立在結果不確定時停用再次送出，要求先重新整理確認。委託使用既有建立表單及連線中斷提示，不新增作品管理流程。

## 已完成的驗證與限制

- Web production build、TypeScript 與本次修改範圍 ESLint 通過。
- `tests/designated-workbench.test.mjs` 6 項流程規則、既有 `tests/admin-api.test.mjs` 7 項串接檢查通過。
- API .NET 10 建置通過；在臨時診斷程式中呼叫實際權限與經理轉單驗證函式，8 項檢查通過，沒有使用資料庫或 HTTP mutation。
- `tests/admin-ui.test.mjs` 8 項既有失敗。以 HEAD 原始碼另匯出隔離目錄執行後，失敗項目完全相同；沒有改寫既有測試湊成功。
- 本地正式入口及原設計稿 HTTP 200；解析建置 CSS 後 12 項宣告符合，包含原間距、標題、桌機欄位、手機觸控尺寸與響應式條件。
- 三個生成字型變數、119 條 font-face 宣告及 116 個字型資源 HTTP 查核通過。
- 瀏覽器回報無法驗證 saved permissions，沒有改用其他瀏覽器或截圖工具繞過。**僅完成 HTTP／原始碼檢查，實際渲染未確認**；Computed styles、Rendered Fonts、登入後的實際互動與資料庫交易尚未驗收。
- 診斷程式 restore 的 NuGet 弱點索引無法連線，出現 NU1900；本地已有套件完成建置與權限檢查。未更動或略過發布環境的套件稽核政策。

2026-10-10 依使用者「先上版 API」指示，API 已發布至正式主機：功能提交 `cc46a8b`，main 發布合併提交 `1d2aeba`。[API CI/CD 發布紀錄](https://github.com/show8301/ToBeClarify-api/actions/runs/38059678969) 的 build、publish、IIS 部署與既有健康檢查均成功。使用者接著要求 Web 發布至測試環境，本次 Web 發布目標為 `dev`／`https://www-dev.marchgroup.net`。

本地代理的 `auth/me`、原 `order-sessions` 及新 `designated-order-sessions` 匿名請求均回傳正常的 401；新端點不再回傳 404。這能確認預覽程序可連至新版 API，但登入後的實際顧客資料與交易流程尚未驗收。

部署後發現 Admin Swagger 回傳 500。本地只建立控制器 metadata、沒有啟動 API／背景工作或連線資料庫，即重現至既有 `MenuNotificationsController.Upload` 的 `[FromForm] IFormFile` 宣告；該控制器、Swagger 設定及套件版本與部署前相同。限定訂購控制器的規格生成檢查則通過：28 個端點包含新的本人資料及承接回應端點，並確認 `NomineeResponseRequest` 與 `isManagerTransfer` 欄位。Client Swagger 及 Swagger UI 正常回傳 200；完整 Admin Swagger 仍需修復。

本次 dev 發布依工作區規範略過全部自動化測試套件，只執行建置、型別／lint 等靜態檢查、部署狀態與 HTTP 可用性檢查。前述流程測試及本地診斷是較早實作階段的紀錄，不代表本次發布有執行測試。部署完成以工作流程成功及測試站 `/api/health` 的 `deploymentSha` 對應發布提交確認；業務端點的匿名 401 只確認 API 連通與登入保護。

Web 正式版仍需使用者確認 dev 正常後，由 dev → main 手動 PR 推進。

## 主要程式位置

- [工作台](../features/admin/operations/AdminDesignatedWorkbench.tsx)、[操作規則](../features/admin/operations/workbenchRules.ts)、[API 邊界](../features/admin/operations/workbenchApi.ts)
- [服務操作](../features/admin/operations/WorkbenchServiceDialog.tsx)、[代客訂購](../features/admin/operations/WorkbenchOrderComposer.tsx)、[加購](../features/admin/operations/WorkbenchAddonForm.tsx)
- [顧客操作](../features/admin/operations/WorkbenchGuestActions.tsx)、[出勤](../features/admin/operations/WorkbenchShiftBar.tsx)、[經理承接協調](../features/admin/operations/WorkbenchManagerRequests.tsx)
- [樣式](../styles/admin/designated-workbench.css)、[CSS 宣告查核](../scripts/preview-css/designated-workbench.json)、[流程檢查](../tests/designated-workbench.test.mjs)
