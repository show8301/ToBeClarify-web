# 服務員工作台與入場實收：整批實作／上版準備

日期：2026-10-17；完成檢查更新：2026-10-18（Asia/Taipei）。範圍：使用者確認的執行順序第 2–8 項，連同先前第 1 項契約與必要 schema 一起準備發布。

狀態：已完成本地原始碼實作；尚未 migration、設定正式入場費、切換舊 Web gate、提交發布分支或部署。此文件不宣稱實際 MariaDB 交易、並行鎖定或登入後畫面已驗收。

## 完成範圍

| 項目 | 實作 |
| --- | --- |
| 2 開碼同筆交易 | 新增 [AdmissionCreationService](../../ToBeClarify-api/src/Services/Ordering/AdmissionCreationService.cs) 與 POST `/api/admin/order-sessions/with-admission`。營業期鎖、收費與額度核對、入場、應收／優惠／實收、初始折抵、UID 歸戶及操作結果在同一 connection／transaction；使用既有入場帳與顧客歸戶的交易內方法。 |
| 2 防重複與查回 | 全域營業鎖後先查原 operation ID；同操作者、同正規化 payload hash 回傳已提交結果，即使預覽已到期或關店也不重收。不同內容重用 ID 拒絕；session／admission 唯一鍵防重。只在初次成功回傳點餐資料，重試回傳 `issued:null`。 |
| 3 開碼抽屜 | 共用 [CreateSessionPanel](../features/admin/orders/CreateSessionPanel.tsx) 接新 API，顯示入場費、折抵、營業日及預覽期限；正常收款需勾選確認。經理可設定數值收費及例外原因／優惠／未收／免收。政策修改使用畫面讀取的版本，不臨送出偷偷採用最新版本。 |
| 3 結果與失敗 | 透過 [useAdmissionCreation](../features/admin/orders/useAdmissionCreation.ts) 保存不確定請求的原 ID／內容。可查回／重試同筆交易；查回後明確選擇重發才輪替憑證，沒有第二次收款。完成畫面顯示金額、時間與經手帳號。 |
| 4 顧客消費紀錄 | 顧客歷史／UID 摘要新增入場應付、實收、實退、消費應付及未登錄數量；一般訂單金額保留原意義。SQL 先按 session 聚合帳款再 join，不因多張訂單倍增入場費。 |
| 4 點餐與後台查詢 | 顧客「今日帳單」明列入場費、優惠與折抵；後台 [AdmissionSummary](../features/admin/orders/AdmissionSummary.tsx) 分開顯示入場與整次消費。訂單查詢新增當日入場紀錄入口，沒有點餐也可查看。帳務成功修改後，同頁入場摘要即時重新讀取。 |
| 5 結算核對 | flow v2 改採逐筆入場應收減折讓，再沿用既有淨實收／保留款分配；不把入場實收再加一次。即使完全沒有收款紀錄也按實收 0 處理，不回退到人數估算。未登錄／負數入場帳列異常，既有 finalize 規則會阻擋未解異常；已完成快照不回算。flow v1 保留舊估算。 |
| 6 待辦與履約 | [服務員工作台](../features/admin/operations/AdminServiceWorkbench.tsx) 按訂單分類、搜尋、每頁 12 張並可查看全部。已確認但未送達、包廂未完成、店家協調與退回經理均會出現；協調單只列一次。展開即可逐項接單／開始／部分完成、補登、取消、改期／保留或同單收款；拒絕協調須填原因。 |
| 6 跨期與資料載入 | `/service-order-sessions`、`/service-orders`、`/service-fulfillment` 納入履約轉入本期的訂單；摘要以本期履約判斷，不擴大為 UID 全歷史。服務員改用批次 HTTP 載入，不逐顧客送訂單請求；履約批次在單一連線順序讀取，尚非單一 SQL 全量查詢。 |
| 7 顧客現場處理 | 新增 [ServiceGuestPanel](../features/admin/operations/ServiceGuestPanel.tsx)：當期顧客搜尋、在場／離店篩選、入場帳、代點餐點／包廂、點餐碼、位置／備註、離店／重開與同單收款。跨期原入場不提供本期代點、重發或重開，保留相關履約及帳務入口。 |
| 8 計數／權限／導覽 | 指標依完整清單計數，不受 6 位截斷；載入／失敗顯示「—」。包廂分項與獨立預約以 orderId 避免重複；獨立預約可於預定時間後開始／完成，例外走完整管理。服務操作仍依 API `allowedActions`；原日期、session、order 帶入完整頁並定位訂單。 |
| 8 響應式與資源 | 新增 [96-service-workbench.css](../styles/admin/layers/96-service-workbench.css)，沿用主指標、共用元件及字型，760px 單欄。新增請求保留取消及過期結果處理；寫入中阻止重送，失敗保留表單／操作結果，對話框放棄代點需確認。 |

共用入場帳抽取時，一併修正實收紀錄的帳款版本遞增位置，避免與入場應收共用相同版本；未收款案件採折讓後淨應付，零淨額不建立未收案件。

舊版整單訂單仍由帶日期／顧客／訂單定位的完整頁處理，不以新版分項按鈕猜測舊整單狀態。獨立包廂沿用原狀態 API；分項訂單內的包廂走履約 API，兩者不混用。

既有 `AdminOrdersPage.jsx`、`AdminOrderListPage.jsx`、`OrderClient.jsx`、開碼抽屜及完成面板僅做接線、摘要與定位的小範圍修改；本次不為此整檔改成 TSX。新增業務、表單、摘要、待辦與契約全部採 TS／TSX；後續若擴大這些既有 JSX 的責任，再安排遷移。

## 本地驗證與待驗收

- API Release build 通過。使用 checkout 既有 .NET 10；NuGet 弱點索引無法連線有 NU1900，未更動套件或關閉稽核。
- 35 項 API 入場契約／開碼輸入邊界記憶體檢查通過；30 項結算回歸通過，涵蓋原香檳／小費／實收分配，以及入場加餐點折抵、只有入場、優惠、退款、未收款及完全無實收紀錄。
- Web 15 項入場契約／待辦／同單收款規則檢查通過；TypeScript 及修改的 TS／TSX lint 通過。既有部分 JSX 不在目前 ESLint matching configuration，不能宣稱已由該 lint 完整驗證；會由 production build 編譯。
- Web production build 通過；CSS 產物解析 17／17 項符合。CSS 檢查採 [service-workbench.json](../scripts/preview-css/service-workbench.json)，不使用壓縮字串或固定 hash。
- 尚未連正式資料庫、套用 migration、啟動／交付本地預覽、執行真實開碼／收款、驗證多端並行或登入後畫面。Computed styles／Rendered Fonts 未確認。後續本地預覽依 [local-ui-preview.md](local-ui-preview.md) 做 3001 production build、匿名 auth/me 401、CSS／字型與實際渲染查核。
- 上述為本地實作回歸，未加入 dev 部署工作流程；後續 dev 部署預設不執行任何自動化測試套件。

## 整批 migration 與發布清單

唯一新增 migration：[20261017_03_admission_creation_contract.sql](../../ToBeClarify-api/db/migrations/20261017_03_admission_creation_contract.sql)。

[發布範圍與檔案 checksum](service-workbench-admission-release-scope.json)列出本次 Web 38 個、API 27 個檔案，協助後續只收本次修改；它是本地準備快照，不是 commit 或部署紀錄。來源再有變動時需重新計算。

SHA-256：`79F76A643FA429C85887E309E4CBFAA5EE08E933483A3392E93358851732C3C9`。

新增三表為 `ORDERING_ADMISSION_POLICY`、`ORDERING_ADMISSION_POLICY_AUDIT`、`ORDERING_SESSION_CREATE_OPERATIONS`。既有入場、帳款、顧客歸戶及履約表重用；不產生歷史收款、不從 `priceText` 推算收費，也不重算歷史結算。政策初值 NULL，需要管理者明確設定正式金額；餐點折抵仍獨立取營運參數。

後續上版依序執行：

1. 核對此次 Web／API 檔案差異，僅收本次改動；工作區另有通知、音效、部署流程及經理廣播的修改，不能因 `git add .` 一併發布。先完成必要的程式碼及 migration 審查，記錄各 repo 發布 commit。
2. 依 API [本地 DBA 程序](../../ToBeClarify-api/docs/DATABASE-MIGRATION-RUNBOOK.md) 使用既有 ignored 設定；唯讀確認實際帳號、目標、grants、MariaDB 版本、前置表／欄位及 migration 套用狀態，保存結構／既有筆數與金額證據。不重跑已完成的前置 migration。
3. 必須確認 ordering finance stage 1／2、營業期版本、`ORDERING_RUNTIME_LOCKS` 的 `operating_period` 鎖、顧客 UID／visit 表及履約表已存在。三個新表如已存在須逐欄／索引比對，不能以 `IF NOT EXISTS` 當成驗證。
4. 套用並驗證 **03** migration，再發布依賴此 schema 的 API `main`。API 沒有獨立測試主機，不能將 API `dev` 當作測試站。保持 `OrderingAdmission:RequireConfirmedCreation=false`，避免目前正式舊 Web 被提前阻擋。
5. Web 部署至 `dev`。先確認正式入場費數值及折抵設定，再由經理在新開碼抽屜設定政策；沒有有效政策時禁止新版開碼，不能默認零元。新版收款需要 flow v2 營業期；若現行仍為 flow v1，先完成舊期，經理明確以新版開啟後續營業期，不在上版時偷偷升級現場營業資料。
6. 查核 API／Web 的 build、靜態設定、發布 SHA、部署狀態與既有 HTTP health；dev 部署不跑測試套件。使用者驗收 dev 的顧客資料、UI 及實際業務流程。由於 dev 共用正式 API，不用假顧客或假收款當驗收資料。
7. 使用者確認該版 dev 後，才人工開啟及合併 Web `dev` → `main` PR。保留目前正式 Web 相容期間的入場紀錄為「未登錄」，不能在此階段補造成已收。
8. 確認正式 Web 已全面使用新流程，才啟用 `OrderingAdmission:RequireConfirmedCreation=true`。舊開碼回 409／`ADMISSION_CLIENT_UPGRADE_REQUIRED`；查詢、既有訂單及明確重發不受影響。

當發生部分 migration、錯誤目標、無權限或部署失敗時停止後續動作，先核對實際狀態。回復 Web 時應同時檢查 gate 相容；保持新增表及既有帳款，不刪帳或回填虛構金流。

## 操作驗收案例

- 正常開碼：畫面與帳款各只出現一次入場實收，未點餐也能查到。
- 斷線／重試／查回：同 ID／內容不重收；查回不輪替碼，明確重發後舊碼失效但費用與額度不重建。
- 金額：入場 100,000 G、餐點折抵 100,000 G、餐點小計 150,000 G，消費應付 150,000 G；入場已收 100,000 G，餐點單另收 50,000 G。優惠、未收、退款及零元入場各自核對，不能以額度或履約完成推定實收。
- 待辦：超過 6 位可分頁看完；已確認但未送達仍有餐點待辦；部分送達保留剩餘數量；跨期只按履約期列入；他人的指名遵守 API 權限。
- 結算：flow v2 未登錄入場帳須先處理，無實收不回退估算；實收與退款只進入既有比例分配一次；舊結算快照不回算。
