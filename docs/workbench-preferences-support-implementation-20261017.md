# 工作台偏好與計薪／支援／通知：第一、二階段

日期：2026-10-17。發布更新：本階段 migration 已由使用者完成，API 已發布；Web 已經 dev 確認後推進 main（f75ba9cfbd30ec6f6c83b91d1aac2faa3dbb56dc）。下列本地檢查敘述為當時紀錄；後續結算變更見 [結算整合紀錄](settlement-payroll-integration-plan-20261017.md)。

本次依使用者選定範圍，只完成面板與帳號偏好、單一計薪職位的保存與核准、支援工作及通知受眾拆分。結算引擎與訓練沙盒留在後續階段。

## 已實作

| 項目 | 行為與位置 |
| --- | --- |
| 固定面板可用性 | API 的 `AdminWorkbench`：clerk 可看服務員／指名，manager／developer 可看三種。不依排班、接單或公開資格限制查看面板。 |
| 帳號偏好 | 登入及 `auth/me` 回傳 `preferredWorkbench`、`availableWorkbenchRoles`。`PUT /api/admin/auth/me/preferences` 只保存登入者自己的合法偏好。 |
| 前端偏好 | [AdminAuthContext.tsx](../features/admin/auth/AdminAuthContext.tsx) 依帳號隔離及序列化寫入；[useWorkbenchPreference.ts](../features/admin/operations/useWorkbenchPreference.ts) 即時切換、回報保存狀態及失敗重試。不使用瀏覽器儲存取代帳號設定。 |
| 深連結 | `?workbench=...` 僅指定目前視角，不寫入偏好；無效或越權值回到合法偏好／帳號預設。首次預設：clerk／developer 為服務員，manager 為經理。 |
| 未排班 | 可以開啟本人指名面板；出勤列將「沒有核准班次」呈現為正常空狀態，資料格式錯誤與 API 失敗另行顯示。未綁定店員不改用全店資料。 |
| 單一計薪職位 | 班表新增 nullable `payrollRole`，有效值 service／designated／manager／backstage。新 Web 要求上班班表選一個職位，員工提報後由經理核准；經理職位檢查目標店員綁定的有效帳號資格。 |
| 舊班表 | 單一可辨識職位帶入；多個前台職位保留待確認，核准前須先指定。舊 Web 省略新欄位時保留最新既有計薪設定，不用先前讀取的值覆寫。 |
| 支援工作 | `scheduledRoles` 保留預排支援資訊，`activeRoles` 表示目前支援，不再要求是預排清單子集。當班依 API 的 `allowedSupportRoles` 調整，指名支援檢查長期 `isNominatable` 資格。 |
| 單項安全更新 | 每日工作狀態支援 `businessDate`＋單一 `supportRole`／`supportEnabled`，或單獨 `stopAcceptingNewOrders`。API 在交易內鎖定人員、班表、每日狀態，保留其他欄位；不接受用每日狀態改排班。 |
| 人力與通知 | 經理列出計薪、目前支援及接單狀態。職位廣播沿用當下核准班次與 `activeRoles`；本人指名通知仍依訂單本人送達。偏好或計薪欄位不參與通知受眾計算。 |
| 排班修改邊界 | 編輯既有班表須核對 ID、店員與營業日，不能利用其他人的班表 ID 修改資料。上班班表再儲存／核准保留目前支援，休假清空支援。 |
| UI 規範 | 沿用 [UI 規範](admin-ui-design-guidelines.md)、[按鈕狀態](admin-button-states.md)、[下拉選單](select-design-standard.md)。計薪欄位共用 `AdminPayrollRoleField`、說明用 `AdminHelp`，區塊用 18px token，表單及 dialog 保留既有尺寸與字級。 |

一般 API client 與其他 JSX 的修改僅為更新身份 provider 匯入路徑或文案，不擴大重構；實質修改的身份 provider 已遷移為 TSX。

## Schema 與發布順序

Migration：[20261017_01_workbench_preferences_payroll_role.sql](../../ToBeClarify-api/db/migrations/20261017_01_workbench_preferences_payroll_role.sql)。新增 `ADMIN_USERS.PREFERRED_WORKBENCH`、`STAFF_DUTY_PLANS.PAYROLL_ROLE`；保留原角色陣列，不重算歷史結算。正式資料庫尚未執行此檔案。

1. 先審查並執行 additive migration，再發布相容的 API；新 API 查詢直接使用新欄位，不可倒置順序。
2. Web 發布至 `dev`，對接 API 的唯一正式主機。API 的 `dev` 僅建置，不是測試服務。
3. 使用者確認 Web 測試站後，才能依 `dev` → `main` 手動推進。

## 階段限制

本次的計薪職位是保存與核准設定，**尚未切換薪資計算來源**。既有結算仍使用原班表角色與人工輸入；指名收入仍可能要求原有指名計薪輸入。跨職位底薪、本人分潤與小費的完整核對需下一階段完成，不能宣稱已解決全部跨職位計薪問題。

原有幕後參與資訊仍保存在舊角色與結算資料，不在本階段刪除或重新解釋。訓練模式、訓練授權與模擬交易均未納入本次。

## 驗證紀錄

- Web TypeScript 檢查與 production build：通過；建置保留既有 chunk 大小及路由靜態分類提示。
- Web 全站 lint：0 error、25 warning；警告均為本次未修改元件的 `no-img-element`。新增／實質修改 TSX 的局部 lint 亦無錯誤。
- API Release build：通過，0 warning／0 error，使用既有 .NET 10 SDK。
- CSS 產物以 PostCSS 與既有 `check-preview-css.mjs` 解析選擇器、宣告及 media context；當次建置的後台 bundle 共 12 項符合，涵蓋 18px 區塊 token、標籤列間距與小驚嘆號桌面／觸控幾何。這是靜態宣告檢查，不代表實際渲染。
- 8 份受影響文件共 97 個本地連結存在；Web／API 差異格式檢查通過。
- 未執行自動化測試套件、正式資料 migration 或登入後營運操作；未啟動／交付本地預覽。瀏覽器 Computed／Rendered Fonts、浮層互動及實際畫面尚未確認。

完整後續清單見[範圍規格](workbench-access-preferences-payroll-plan-20261017.md)。
