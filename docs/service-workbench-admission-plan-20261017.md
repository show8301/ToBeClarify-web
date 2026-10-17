# 服務員工作台與開碼入場實收：實作清單

日期：2026-10-17。狀態：第 1 部分與使用者後續指定的第 2–8 項已完成本地原始碼實作；[契約](../../ToBeClarify-api/docs/ADMISSION-CREATION-CONTRACT.md)、[整批實作／上版準備](service-workbench-admission-implementation-20261017.md)記錄實際範圍及限制。未執行 migration 或發布。

本文件保留最初盤點及整體驗收條件；以下「現況」為實作前基準，完成範圍以整批實作紀錄為準。資料庫交易、並行與登入後畫面仍待實際驗收。

## 1. 已確認的現況

- [服務員工作台](../features/admin/operations/AdminOperationsDashboards.tsx)的一般待辦只有顧客摘要，沒有處理入口；協調單已有接受／拒絕，但拒絕原因固定，沒有品項明細。
- 一般待辦依顧客 `waitingOrderCount > 0` 篩選並截取 6 位。API 該數量主要依 `submitted`、`needs_reschedule`、`partially_confirmed` 聚合，不能代表全部未完成履約。包廂指標亦先截取 6 筆再計數。
- [開碼表單](../features/admin/orders/CreateSessionPanel.tsx)不包含收款確認。[API 開碼服務](../../ToBeClarify-api/src/Services/Ordering/OrderingService.cs)建立入場紀錄及餐點折抵額度，未同步建立入場帳／實收。
- 已有入場事件、應收、折讓、實收、實退、操作識別碼及帳款版本機制：[入場帳 repository](../../ToBeClarify-api/src/Repositories/Ordering/OrderingFinanceRepository.cs)、[帳務契約](../../ToBeClarify-api/src/Models/Dtos/OrderingFinanceDtos.cs)。現有入場帳限 flow v2，實作必須明確處理舊版營業期。
- [今日帳單](../features/ordering/components/OrderClient.jsx)已有收退款明細；API 已回傳入場費／優惠／折抵／狀態，但 UI 尚未獨立清楚列示這些欄位。
- [歷史顧客](../features/admin/customers/AdminCustomersPage.tsx)已有實收淨額，但訂單金額只累計一般訂單，需要另外呈現入場費與完整消費應付，不能直接將實收加到訂單總額。
- [結算服務](../../ToBeClarify-api/src/Services/Admin/Settlement/SettlementService.cs)仍有以開碼數乘入場單價計算入場收入的路徑；必須與逐筆入場帳及既有實收分配邏輯一併核對。

## 2. 業務與帳務規則

1. 正常流程為「確認已收到入場費 → 開立點餐碼及記錄入場應收／實收 → 提供點餐資料」。建立成功時一併記錄經手人、時間、顧客入場紀錄及收款營業期。
2. 入場費、優惠／折讓、餐點可折抵額度分開保存。第 1 部分確定新流程採 `ORDERING_ADMISSION_POLICY.ADMISSION_AMOUNT` 數值政策，額度沿用 `ORDERING_SETTINGS.MINIMUM_MEAL_CREDIT`；不解析顯示文案，也不以折抵額度推定收費。缺少有效數值設定時須回報，不能靜默記為零。
3. 正常開碼全額記實收淨應付。優惠、免收或未收款沿用既有明確狀態與原因；操作資格由 API 決定，未收款不能記為已收。不新增任意部分入場收款功能。
4. 開碼、入場事件、帳款與折抵初始值在同一資料庫交易內完成；不能由 Web 先開碼、再另發收款請求拼接。
5. 同一入場紀錄只有一次初始入場收款。重複點擊、連線重試、尋回／重發碼及重開點餐都不能重複收款或重給折抵。重試使用同一 operation ID，核對同一請求內容，回傳同筆結果。
6. 操作結果查回不能透過日誌或帳務快照保存明碼點餐憑證；收款結果與點餐憑證的恢復分開設計，不因重試自動輪替憑證。
7. 入場帳獨立於一般餐點／指名訂單。顧客點餐單顯示入場已收摘要與本單折抵，不能在每張訂單重加一筆入場費。只有入場、沒有點餐，也必須看得到消費及收款紀錄。
8. 消費應付、實收、實退、折抵與履約進度分開呈現。退款／更正沿用既有帳務流程及稽核紀錄，不因取消某張餐點單自動退入場費。
9. 舊入場資料缺乏收款證據時顯示未登錄，不批次推定已收或改寫已完成結算。

金額例：入場應付且實收 100,000 G，餐點額度 100,000 G；餐點小計 150,000 G，折抵後另付 50,000 G。總應付為 150,000 G，入場已收 100,000 G，尚欠 50,000 G；額度使用不產生第二筆實收。

## 3. Web 修改項目

| 編號 | 修改項目 | 實作範圍與完成條件 |
| --- | --- | --- |
| W01 | 開碼收費表單 | 在既有開碼抽屜內呈現入場費、優惠、淨實收、折抵額度及收款確認；正常按鈕為「確認收款並開立點餐碼」。所有開碼入口共用同一表單與 API 契約。 |
| W02 | 開碼結果與重試 | 顯示點餐資料及已收金額／時間／經手人；送出中防重複；連線中斷保留操作識別碼並可查回同筆結果。 |
| W03 | 待辦資料與分類 | 依訂單及分項履約建立待辦，包含店家協調、餐點待處理／送達、包廂待處理、待經理協調；同筆不重複列示。依緊急程度／等待時間排序，提供完整列表或分頁。 |
| W04 | 待辦現場操作 | 每列顯示顧客、位置、訂單、品項摘要、等待時間與原因；展開逐項接單、開始、部分完成／送達。協調單可檢視內容並填寫拒絕原因。 |
| W05 | 顧客現場處理面板 | 新增當期顧客搜尋、在場／離店篩選、訂單明細；提供代點、重發碼、位置／備註、離店／重開及同單收款。已無等待訂單的顧客仍可搜尋處理。 |
| W06 | 精準導覽及指標 | 完整處理入口帶入營業日、顧客及可支援的訂單定位；四張指標可篩選對應清單。計數使用完整資料，區分訂單數、履約項目數、顧客數；失敗不顯示為零。 |
| W07 | 顧客與消費歷史 | 歷史顧客、UID 摘要及當次明細增加入場費／優惠／實收狀態與消費應付；保留一般訂單金額的原有意義，明確標示合計範圍。 |
| W08 | 點餐單與查詢 | 顧客今日帳單、後台顧客訂單及訂單查詢加入獨立入場摘要。選定顧客但尚未下單時也可查看；全日查詢須有入場收費紀錄入口。每張點餐單只計當次折抵與應付。 |
| W09 | 權限及例外呈現 | 指名／加購按 API 的本人限制與 `allowedActions` 顯示操作；取消、補登、改期／跨期收在「其他處理」，需經理處理者清楚標記。收款依 `canWrite`、版本及帳務歸屬核對。 |
| W10 | 狀態與版面 | 沿用 AdminPanel／Button／Dialog、字型、18px 區塊間距及明暗主題。保留草稿、載入／失敗／空資料、防重送及操作完成後更新；手機可逐列處理。 |

主要修改位置：

- [工作台組合與資料載入](../features/admin/operations/AdminRoleOperationsPage.tsx)、[服務員面板](../features/admin/operations/AdminOperationsDashboards.tsx)、[工作台契約](../features/admin/operations/operationsTypes.ts)。新增獨立 TSX 面板，避免擴大單一 dashboard 檔案。
- [開碼表單](../features/admin/orders/CreateSessionPanel.tsx)、[開碼抽屜](../features/admin/operations/AdminCreateOrderPassDrawer.jsx)、[開碼結果](../features/admin/orders/AdminOrderPassPanels.jsx)。
- [顧客歷史](../features/admin/customers/AdminCustomersPage.tsx)、[歷史契約](../features/admin/customers/types.ts)、[完整訂單](../features/admin/orders/AdminOrdersPage.jsx)、[訂單查詢](../features/admin/media/AdminOrderListPage.jsx)、[顧客點餐頁](../features/ordering/components/OrderClient.jsx)。
- 重用／抽取 [履約操作](../features/admin/orders/OrderFulfillmentPanel.tsx)、[完成視窗](../features/admin/operations/WorkbenchItemCompletionDialog.tsx)、[收款視窗](../features/admin/operations/WorkbenchOrderReceiptDialog.tsx)、[顧客操作](../features/admin/operations/WorkbenchGuestActions.tsx)的適用能力；實質修改 JSX 時評估遷移 TSX。跨功能依賴遵循 [coding-standards.md](coding-standards.md)。

### 面板位置

```text
div.adminRoleDashboard-service
├─ 原有出勤列及四張指標卡
├─ section.adminRoleDashboardServiceCoordination  現場待辦（保留全寬）
│  ├─ div.serviceTaskFilters                     分類／搜尋
│  ├─ div.adminRoleDashboardRows
│  │  └─ article.serviceTaskRow
│  │     ├─ 摘要及 div.serviceTaskActions
│  │     └─ div.serviceTaskDetail                 展開品項／履約
│  └─ div.serviceTaskPagination
├─ section.serviceGuestPanel                     新增：顧客現場處理
│  ├─ 顧客搜尋與入場／實收摘要
│  ├─ 顧客常用操作
│  └─ 同顧客訂單、履約與收款
└─ section.adminRoleDashboardServiceQuickLinks    保留完整管理入口
```

`service…` 是建議新增 class。包廂待辦放在待辦分類，完整排程仍經包廂管理入口，遵循 [現有 UI 配置](admin-ui-design-guidelines.md)，不另加整份排程面板。

## 4. API、資料與結算修改項目

| 編號 | 修改項目 | 實作範圍與完成條件 |
| --- | --- | --- |
| A01 | 收費預覽與開碼契約 | 由 API 提供有效入場費及折抵設定；開碼請求帶操作識別碼與收費確認。送出時核對最新收費，價格變動要求重新確認，不採信瀏覽器金額。 |
| A02 | 開碼與入場帳交易 | 在同一 connection／transaction 完成入場、應收、優惠、實收與折抵初始化；抽出既有入場帳交易內方法，避免巢狀獨立交易。沿用已發生金流的經手人及營業期歸屬。 |
| A03 | 防重複與查回 | 同一操作重試回傳原入場結果；不同內容重用識別碼拒絕；不同操作並行為同顧客開碼也只有一筆入場費。既有入場帳手動補登不再重收。 |
| A04 | 營業期與版本相容 | 處理 flow v1／v2、關店與結算鎖定；既有正式 Web 與 API 發布順序需相容。舊客戶端開碼不應靜默造成未收卻記實收，具體相容契約在第一階段確定。 |
| A05 | 待辦與履約資料 | 補足一般服務員所需的待處理／處理中分項；沿用 API 權限。核對跨期轉入本期的項目，不能僅依原入場日漏列；避免每次刷新全店逐單大量請求，優先批次摘要、展開再取明細。 |
| A06 | 消費歷史契約 | 擴充 [顧客歷史查詢](../../ToBeClarify-api/src/Repositories/Customers/CustomerDeliveryRepository.cs)與 DTO；入場應付與實收分開聚合，UID 跨日摘要不因 join 倍增金額。 |
| A07 | 帳單與結算一致性 | 新流程以逐筆入場應收、折讓與實收／實退核對；調整開碼數乘單價的估算路徑，保留舊資料明確來源及既有結算快照。沿用既有實收分配／保留邏輯，避免再次加入同筆入場實收或重算歷史薪資。 |
| A08 | Schema 需求確認 | 第 1 部分已準備新增收費政策、政策稽核及開碼操作快照三表的 [migration](../../ToBeClarify-api/db/migrations/20261017_03_admission_creation_contract.sql)，未執行。入場與收款沿用原帳務表；開碼查回不混入既有帳務操作快照，也不保存點餐憑證。 |

## 5. 實作順序

1. **本次實作範圍：** 確定有效收費來源、開碼確認／查回契約、舊 Web 相容方式與必要 schema；分清入場收入及折抵。原始碼與未執行 migration 已加入，完成範圍見第一階段契約。
2. 完成 API 同筆交易、帳務防重複、收費與入場結果契約，再接開碼表單及完成畫面。
3. 接上歷史顧客、今日帳單、後台訂單／查詢及結算入場收入核對，先完成收款資料流。
4. 重整待辦資料與指標，完成分類、明細展開、餐點／包廂處理及精準導覽。
5. 新增顧客現場處理區，串接代點、碼、離店、備註及同單收款，完成響應式與錯誤狀態。

## 6. 驗收與發布條件

- 開碼成功但尚無餐點單時，後台與顧客端均能看見一次入場應付及實收。
- 依第 2 節金額例核對應付／實收／尚欠；折抵、優惠與退款不重複計算。
- 重複開碼、連線中斷重試、重發碼、重開點餐、手動補登及並行操作不新增第二筆入場實收；任一交易寫入失敗不留下半筆入場／額度。
- 正常收款、優惠／免收、未收款、資料版本衝突及已關店／結算狀態有明確結果；舊資料不自動補成已收。
- 現場可在工作台完成餐點逐項／部分送達、包廂收尾、協調決定及同單收款；其他人的指名不會出現越權按鈕。
- 待辦超過 6 位仍可全部查看；計數不受顯示截斷影響，已確認但未完成的項目不漏列。
- 消費歷史、顧客帳單、後台帳款與結算互相一致；已確認結算快照不被新規則回算。
- 實作階段執行 Web build、typecheck、適用 lint 及 API build；針對交易、防重複、金額守恆及權限準備有意義的回歸案例。dev 部署不自動執行測試套件，除非使用者明確要求該次測試。
- 本地畫面驗收遵循 [local-ui-preview.md](local-ui-preview.md)：production build、3001、匿名 auth/me 401、CSS／字型與實際渲染確認；尚未驗證的項目明確標示。連接真實 API 的收款操作不得冒充模擬測試。
- 本次完成本地實作及整批發布準備，尚未啟用或發布。後續先依 API [本地 DBA 程序](../../ToBeClarify-api/docs/DATABASE-MIGRATION-RUNBOOK.md)處理必要 migration，再走 API `main` 正常正式流程；Web 先 `dev`，使用者確認後才人工 `dev` → `main`。
