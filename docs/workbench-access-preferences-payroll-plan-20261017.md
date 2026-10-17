# 工作台自由切換、帳號偏好與單一計薪職位調整清單

日期：2026-10-17。

狀態：使用者已指定先完成「面板與偏好 → 計薪／支援／通知」。這兩階段的本地原始碼已完成，詳見[實作與驗證紀錄](workbench-preferences-support-implementation-20261017.md)；尚未執行資料遷移或部署。下方保留完整規劃，未勾選不一定表示完全沒有原始碼，亦可能包含後續整合或實際驗收條件；結算引擎與訓練模式仍待後續。

## 1. 已確認的需求

| 項目 | 目標行為 |
| --- | --- |
| 一般店員 `clerk` | 可自由切換服務員、指名人員兩個正式工作台，不依當日排班開放面板 |
| 經理 `manager` | 可自由切換服務員、指名人員、經理三個正式工作台 |
| 開發者 `developer` | 保留三種工作台的檢視能力；預覽標示不等同於訓練沙盒 |
| 面板偏好 | 依登入帳號保存至 API／資料庫，跨營業日、重新登入與不同裝置沿用 |
| 未排班 | 仍可查看工作台；未排班、沒有資料與 API 失敗須分開呈現 |
| 彈性支援 | 可以執行帳號獲准的現場工作，切換面板及支援不改變計薪職位 |
| 計薪 | 每班指定單一計薪職位；由經理確認，員工切換面板不能修改 |
| 訓練 | 使用模擬情境練習；正式資料與操作、個人正式偏好均不受影響 |

指名面板保留「自己的指名／加購、服務及相關顧客」範圍；服務員工作台沿用現場工作所需資料；經理資料與管理操作仍由 API 驗證管理角色。

## 2. 調整前盤點與實際相依

| 現況 | 已確認的程式位置 | 調整原因 |
| --- | --- | --- |
| 可用面板由帳號角色及 `todayWorkMode.scheduledRoles` 決定，一般員工預設又參考 `activeRoles` | [AdminRoleOperationsPage.tsx](../features/admin/operations/AdminRoleOperationsPage.tsx) | 無排班時無法選指名面板；面板與實際職位耦合 |
| 選擇保存在 `sessionStorage`，key 含帳號與營業日；`workbench` 網址參數也會寫入該記錄 | 同上 | 無法跨營業日及裝置保存；深連結可能覆蓋偏好 |
| 登入身份回應沒有工作台偏好 | [Web 身份型別](../features/admin/auth/types.ts)、[API 身份契約](../../ToBeClarify-api/src/Models/Dtos/AdminAuthDtos.cs)、[帳號查詢](../../ToBeClarify-api/src/Repositories/Admin/Auth/AdminAuthRepository.cs) | 需新增帳號級持久化及登入時載入 |
| 本人指名顧客 API 依登入者綁定的店員查詢，服務入口未檢查排班職位 | [OrderingService.Fulfillment.cs](../../ToBeClarify-api/src/Services/Ordering/OrderingService.Fulfillment.cs) | 不需要為開放面板另建全員訂單查詢；交易限制應個別檢查 |
| 新指名建立會驗證公開資格、核准班次時段與停止接單狀態 | [OrderingRepository.Fulfillment.cs](../../ToBeClarify-api/src/Repositories/Ordering/OrderingRepository.Fulfillment.cs) | 查看面板與實際接受新單必須分開 |
| 「本班工作職位」只能啟用已排班的職位 | [StaffWorkStatusPanel.tsx](../features/admin/operations/StaffWorkStatusPanel.tsx)、[AdminContentService.cs](../../ToBeClarify-api/src/Services/Admin/Content/AdminContentService.cs) | 現場支援需要與薪資職位分欄，不能只改文案 |
| 按職位廣播使用 `activeRoles`，且要求正在執勤 | [MenuNotifications.cs](../../ToBeClarify-api/src/Services/Menu/MenuNotifications.cs) | 切換面板不能改變廣播受眾；臨時支援職位要能獨立調整 |
| 結算從班表的多職位清單推導計薪角色，多個前台職位時產生歧義 | [SettlementAttendanceSync.cs](../../ToBeClarify-api/src/Repositories/Admin/Settlement/SettlementAttendanceSync.cs) | 需以明確單一計薪職位取代多職位推導 |
| 指名收入／指定小費會查找 `designated` 結算輸入，缺少時標記 `DESIGNATED_INPUT_MISSING` | [SettlementService.cs](../../ToBeClarify-api/src/Services/Admin/Settlement/SettlementService.cs) | 跨職位支援不能被迫新增第二份底薪輸入，亦不能漏算原本服務所得 |
| 既有幕後參與可與前台計薪並存 | [出勤與結算同步規格](../../ToBeClarify-api/docs/settlement-attendance-sync.md) | 要保留幕後分潤的獨立語意，不能將「單一計薪職位」誤套為刪除既有分潤 |

以上為原始碼盤點，未查詢正式資料庫或核對正式站部署版本。

## 3. 具體調整項目

### A. 帳號可用工作台

- [x] 將 `clerk` 固定對應 `service`、`designated`；`manager`／`developer` 對應三種面板。
- [x] 移除面板可用性對 `scheduledRoles`、`activeRoles`、是否排班及公開「開放指名」開關的依賴。
- [x] 統一 API 與 Web 的可用工作台契約；帳號降權後不得沿用經理視角或經理資料。
- [x] 未綁定店員時仍呈現清楚的身份綁定提示，不改抓全店資料冒充本人資料。

主要位置：[AdminRoleOperationsPage.tsx](../features/admin/operations/AdminRoleOperationsPage.tsx)、[operationsTypes.ts](../features/admin/operations/operationsTypes.ts)、API auth 契約與服務。

### B. 帳號保存偏好

- [x] 在帳號資料新增可為空的 `preferredWorkbench`；migration 對應 `ADMIN_USERS.PREFERRED_WORKBENCH`，有效值為 `service`、`designated`、`manager`。
- [x] 登入及 `GET /api/admin/auth/me` 回傳偏好與該帳號可用的工作台。
- [x] 新增本人偏好更新端點 `PUT /api/admin/auth/me/preferences`，只接受當前帳號允許的面板；不接受前端任意指定帳號 ID。
- [x] 點選工作台立即切換並儲存帳號偏好，顯示儲存結果；失敗時保留目前視角並提供重試，不宣稱已保存。
- [x] 移除以營業日區分的 `sessionStorage` 選取來源，不以 `localStorage` 代替帳號設定。
- [x] 實作序列化寫入、帳號切換與過期請求防護；跨裝置以下次讀取 API 的值為準，不額外要求即時同步。實際跨裝置操作待驗收。

首次沒有偏好時：一般店員預設服務員，經理預設經理，開發者預設服務員。`?workbench=...` 僅作本次有效視角指定，不自動改寫長期偏好；使用者明確點選面板才保存。無效／越權參數回退至有效偏好或上述預設。

主要位置：API [AdminUserEntities.cs](../../ToBeClarify-api/src/Models/Entities/AdminUserEntities.cs)、[AdminAuthRepository.cs](../../ToBeClarify-api/src/Repositories/Admin/Auth/AdminAuthRepository.cs)、[AdminAuthService.cs](../../ToBeClarify-api/src/Services/Admin/Auth/AdminAuthService.cs)、[AdminAuthController.cs](../../ToBeClarify-api/src/Controllers/Admin/AdminAuthController.cs)，及其 interface／DTO；Web [AdminAuthContext.tsx](../features/admin/auth/AdminAuthContext.tsx)、[types.ts](../features/admin/auth/types.ts)、[client.js](../features/admin/api/client.js) 與工作台入口。身份 provider 已遷移為 TSX。

### C. 未排班與無資料畫面

- [ ] 無班表仍能進入本人指名面板並讀取允許的本人資料。
- [ ] 分別呈現「今日尚未排班」「尚未到班／未打卡」「本期沒有指名」「資料讀取失敗」。
- [ ] 接單／服務操作顯示 API 規則對應的不可操作原因；查看面板本身不建立排班、打卡或接單紀錄。
- [ ] 各面板共用本人出勤狀態，避免換面板後出勤資訊不一致。

主要位置：[AdminDesignatedWorkbench.tsx](../features/admin/operations/AdminDesignatedWorkbench.tsx)、[WorkbenchShiftBar.tsx](../features/admin/operations/WorkbenchShiftBar.tsx)、[AdminOperationsDashboards.tsx](../features/admin/operations/AdminOperationsDashboards.tsx)。

### D. 現場支援與正式操作

- [ ] 逐項核對發點餐碼、入場、訂單確認、代點餐、包廂、本人指名承接及履約的 API 條件，移除把「計薪職位」當操作授權的耦合。
- [ ] 保留帳號權限、本人服務歸屬、核准班次／出勤、接單開關、時段衝突及訂單狀態等適用檢查；不把未排班可查看變成未排班可接新指名。
- [ ] 臨時支援已有班次的員工時，不必修改薪資職位；完全未排班要實際接單時，沿用經理加入臨時排班流程。
- [ ] 實際操作記錄登入帳號、服務執行者與交易歷史；切換面板不改寫訂單服務歸屬。

### E. 單一計薪職位與排班

- [x] 在班表新增明確的單一 `payrollRole`，與現場支援職位分開；員工可提報，經理核准。接入結算屬後續 G。
- [x] 值班規劃、經理臨時排班及調班表單均呈現單選「本班計薪職位」；舊多職位清單保留作相容資料。
- [x] 經理計薪職位的選擇須由 API 驗證資格，不因員工能選面板而開放管理計薪資格。
- [x] 計薪職位異動記錄修改者及核准資訊；員工不能藉工作台或支援開關自行更改計薪。
- [ ] 既有幕後參與分潤另欄保存；核對一般日與活動日既有工時／分潤規則，不在本次順便變更費率或分配比例。

目前班表以「店員＋營業日」唯一，結算以「營業日＋營業時段」管理。本次沿用現有單位，不另擴充同一人同日多段、各自採不同計薪職位的班表功能。跨午夜仍歸原班表營業日。

主要位置：API [AdminContentDtos.cs](../../ToBeClarify-api/src/Models/Dtos/AdminContentDtos.cs)、[AdminContentService.cs](../../ToBeClarify-api/src/Services/Admin/Content/AdminContentService.cs)、[AdminContentRepository.cs](../../ToBeClarify-api/src/Repositories/Admin/Content/AdminContentRepository.cs) 及 entity；Web [AdminDutyPlanningPage.tsx](../features/admin/duty-planning/AdminDutyPlanningPage.tsx)、[TemporaryDutyPlanDialog.tsx](../features/admin/operations/TemporaryDutyPlanDialog.tsx)、[staffing.ts](../features/admin/operations/staffing.ts)、[operationsTypes.ts](../features/admin/operations/operationsTypes.ts)。

### F. 支援職位與通知

- [x] 將現有「本班工作職位」明確改為「目前支援工作」，與唯讀／經理管理的「本班計薪職位」分開。
- [x] 當班可啟用服務員、指名等符合資格的支援職位，不再因計薪只選一個職位而限制支援。
- [x] `activeRoles` 只控制支援與依職位廣播受眾；切換畫面與偏好不自動改變它。訓練尚未實作。
- [x] 同步調整 API 的 `activeRoles ⊆ scheduledRoles` 舊驗證與 Web 回應驗證，保留核准值班時段及工作資格條件。
- [x] 保留本人指名通知依訂單受指名者送達的既有規則。
- [x] 經理當班人力列同時顯示計薪職位、支援工作與接單狀態，避免把三者混成一個角色。

主要位置：[StaffWorkStatusPanel.tsx](../features/admin/operations/StaffWorkStatusPanel.tsx)、[staffWorkStatus.ts](../features/admin/operations/staffWorkStatus.ts)、[ManagerStaffingPanel.tsx](../features/admin/operations/ManagerStaffingPanel.tsx)、API content 服務／repository 及 [MenuNotifications.cs](../../ToBeClarify-api/src/Services/Menu/MenuNotifications.cs)。

### G. 出勤與結算

- [ ] 出勤繼續沿用既有核准班表、打卡、人工修正與工時計算，不由工作台停留時間推算工時。
- [ ] 結算從核准的單一計薪職位帶入底薪／工時輸入，停止從多職位清單猜測前台角色。
- [ ] 保存輸入、重新計算與正式結算均檢查同一人在該班／結算範圍的單一計薪職位；不只阻擋「同一人同一角色重複」。
- [ ] 將本人指名分潤、指定小費及其他既有服務所得與底薪職位分開對應；支援後不用建立第二份底薪輸入才能領取本人服務所得。
- [ ] 調整 `DESIGNATED_INPUT_MISSING` 等異常判斷及個人／全員明細，呈現單一計薪職位與各收入組成。
- [ ] 同時核對一般日、活動日、幕後參與、香檳塔、包廂、公共小費及相關結算來源，保留既有費率、分配規則與總額守恆。
- [ ] 既有人工結算輸入與已鎖定結算保留；有衝突時提示管理者確認，不默默重選職位或重算歷史薪資。

主要位置：API [SettlementAttendanceSync.cs](../../ToBeClarify-api/src/Repositories/Admin/Settlement/SettlementAttendanceSync.cs)、[SettlementRepository.cs](../../ToBeClarify-api/src/Repositories/Admin/Settlement/SettlementRepository.cs)、[SettlementService.cs](../../ToBeClarify-api/src/Services/Admin/Settlement/SettlementService.cs)、DTO／entities；Web [AdminSettlementPage.tsx](../features/admin/settlement/AdminSettlementPage.tsx)、[SettlementOperations.tsx](../features/admin/settlement/SettlementOperations.tsx)、[AttendancePanel.tsx](../features/admin/settlement/AttendancePanel.tsx)、[types.ts](../features/admin/settlement/types.ts) 及受影響明細元件。

### H. 訓練模式

- [ ] 新增清楚的「訓練預覽」入口、持續可見的訓練標示、情境重設與返回正式工作台。
- [ ] 準備有內容的服務員、指名人員、經理模擬情境，包含待確認訂單、本人指名、忙碌／衝突及經理介入。
- [ ] 基本訓練面板沿用帳號可見範圍；若一般店員需要經理面板訓練，由經理額外授予訓練面板與期限，僅開放模擬資料。
- [ ] 模擬操作保留在訓練狀態；所有子元件、出勤、交易、通知與偏好寫入都使用訓練專用入口，不能沿用內部直接呼叫正式 mutation 的元件。
- [ ] 訓練選擇不覆蓋正式工作台偏好，不增加管理角色，不在正式 API 錯誤時切成模擬成功。

可參考既有 [DesignatedPreview.tsx](../features/admin/designated-preview/DesignatedPreview.tsx) 的模擬展示，但需另補三角色的訓練情境與安全的互動資料來源；目前的 `DEVELOPER PREVIEW` 正式工作台不能直接視為沙盒。

### I. 資料遷移與相容

- [ ] 新增帳號偏好、班表計薪職位及必要的訓練授權資料 migration；本清單不直接操作正式資料庫。
- [ ] 舊帳號偏好為空時使用固定預設，不能從某個裝置的舊暫存推斷所有裝置偏好。
- [ ] 舊班表只有一個可辨識計薪職位時可安全帶入；多個職位且沒有既有明確核定來源時列為待確認，不猜選服務員或指名人員。
- [ ] 保留原班表職位資訊作為支援與歷史相容資料，避免遷移過程改變通知受眾。
- [ ] 新 API 對舊 Web 保持相容，舊呼叫端不帶 `payrollRole` 時保留既有已指定值；不可把缺欄視為清空或重新推導。
- [ ] 正式 Web、dev Web 共用同一 API，需先上相容的 additive 契約，再切換 Web，最後才考慮停用舊欄位語意。

### J. 文件與驗證

- [ ] 更新 [店員執勤狀態](staff-duty-status.md)、[指名工作台](designated-workbench-implementation-20261010.md)、[經理工作台](manager-workbench-20261016.md) 及 API 的身份、值班、結算與通知契約文件。
- [ ] 規劃並記錄下節驗收結果；清單勾選必須有實作或驗證證據，不能把原始碼盤點當成功能已完成。

## 4. 驗收情境

| 情境 | 預期結果 |
| --- | --- |
| 一般店員沒有今日排班 | 兩個面板均可進入；本人指名資料正常顯示或呈現無資料；新單仍依 API 資格 |
| 經理只排一種工作或完全未排班 | 三個面板均可切換；管理交易保留原權限及營業狀態限制 |
| 選指名面板後登出、隔日重登、換裝置 | 讀取同一帳號保存的指名偏好 |
| 帳號 A 登出後帳號 B 登入 | 不帶入 A 的偏好、訂單或未完成請求結果 |
| 使用工作台深連結 | 本次開啟指定的允許面板，不自動改掉帳號偏好 |
| 非經理使用經理面板參數或偏好 request | 不開放正式經理面板／資料；API 拒絕越權偏好 |
| 快速切換面板、偏好儲存失敗 | 不回寫過期選擇；失敗狀態可見且可重試 |
| 跨午夜、開新營業日 | 偏好不變，出勤、訂單與結算依 API 營業日更新 |
| 服務員計薪職位者臨時支援指名 | 可以依資格支援，紀錄實際服務者；只有一份底薪，服務所得不遺漏、不重複 |
| 切換工作台／進出訓練 | 不改接單狀態、支援職位、通知受眾、打卡與計薪職位 |
| 調整目前支援工作 | 影響對應的職位廣播，不修改計薪職位；本人指名通知繼續送達 |
| 舊班表有多個職位 | 保留原資訊，明確要求核定單一計薪職位，不自動選擇 |
| 既有幕後兼任／一般日／活動日結算 | 費率及分配規則一致，沒有多份底薪或小費重複計入 |
| 已正式結算的歷史資料 | 不因 migration、偏好或支援調整而重算 |
| 員工訓練經理面板 | 僅在獲准期限內開放模擬情境，正式權限不變；重設不影響營業資料 |

## 5. 建議實作順序與發布邊界

1. 帳號偏好與固定面板可用性：先解決未排班無法看面板及偏好跨日問題，可獨立交付。
2. 班表單一計薪職位、目前支援工作及通知：先建立清楚的資料契約，再同步表單與 API 驗證。
3. 出勤／結算相容與收入明細：必須在完整開放跨職位營運支援前完成，避免留下計薪歧義。
4. 三角色模擬訓練與授權：沿用完成後的畫面與契約，隔離正式操作。

以上分段供實作與審查使用，不代表只需完成第一段即可宣稱整體需求完成。

Web 程式變更依 [coding-standards.md](coding-standards.md) 執行適用的 build、型別與靜態檢查；API 執行 restore／build 等適用檢查。自動化套件的執行依當次使用者要求與儲存庫政策，不能自動加入 dev 發布流程。需要本地畫面預覽時依 [local-ui-preview.md](local-ui-preview.md) 驗證正確 checkout、API 連線、CSS 與字型。

發布仍採 Web 先 `dev`，使用者確認後再由 `dev` → `main` 手動推進。API 沒有測試主機，需走 `main` 的正式發布流程，因此 API／migration 的相容性需先完成；本輪盤點未執行任何發布。
