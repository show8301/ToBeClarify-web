# 繪圖／簽繪交付權限稽核

稽核日期：2026-10-10。範圍為交付頁、歷史顧客入口、後台交付 API、service、repository、顧客領取 API 與資料表 migration。

這是目前工作區程式碼的靜態稽核，沒有修改操作權限、部署或送出真實顧客資料異動。尚未以使用者目前登入的指名帳號實際送出操作，因此不能把未取得的 HTTP 403 或帳號角色當成已驗證事實。

## 主要結論

1. 店員帳號可以「建立作品並產生領取碼」。建立 API 沒有經理限定；成功建立時會自動產生一組單筆領取碼。
2. 「重發單筆領取碼」限定 `manager`／`developer`。前端隱藏店員的重發按鈕，API 也有相同限制；不是只改按鈕就能開放。
3. 使用者截圖中的作品名稱空白。建立按鈕的停用條件是處理中或名稱空白，該畫面不包含店員角色的停用判斷。
4. 「指名人員」是營運職務，交付授權使用的是後台帳號角色。目前沒有依指名人員、訂單指名或作品負責人限制交付操作。
5. 所有登入店員都能查閱及修改全店交付，包括未開放的私密圖片、作品狀態與附件。若預期指名人員只管理自己的作品，目前的實作尚未提供這種範圍控管。

## 帳號角色與授權

後台帳號只有 `clerk`（店員）、`manager`（經理）、`developer`（開發者）三種角色。`designated`（指名人員）等營運職務不在這份授權角色清單中；切換工作台或今日啟用職位不會讓 `clerk` 取得經理權限。

- `AdminOnly`：有效登入，角色為上述三者之一。
- `AdminManager`：有效登入，角色為 `manager` 或 `developer`。
- API 會檢查 JWT、帳號啟用狀態、token version 與目前帳號角色；過期、撤銷、停用或角色已變更的 token 不能繼續使用。
- Web 交付頁、歷史顧客頁及其導覽項目都開放三種後台角色。
- Web 透過同站 `/api/admin` 代理攜帶登入 cookie；代理另有跨站異動來源檢查。操作授權由 API 執行。

來源：API `src/Auth/AdminRole.cs:5`、`Program.cs:307`、`Program.cs:340`；Web `features/admin/layout/AdminLayout.jsx:21`、`features/admin/shell/AdminRoutes.jsx:124`、`app/api/admin/[...path]/route.ts:46`。

## 目前後台操作矩陣

下列「店員」也包括後台帳號角色為 `clerk` 的指名人員。允許仍須通過表單與資料狀態檢查。

| 操作 | 店員 clerk | 經理 manager | 開發者 developer | API 與實際範圍 |
|---|---|---|---|---|
| 進入交付頁、歷史顧客頁 | 允許 | 允許 | 允許 | Web 登入保護，沒有經理限定 |
| 搜尋／查看交付清單及單筆明細 | 允許 | 允許 | 允許 | `GET /art-deliveries`、`GET /art-deliveries/{id}`；全店資料，沒有操作者歸屬篩選 |
| 建立作品並產生初始領取碼 | 允許 | 允許 | 允許 | `POST /art-deliveries`；任一有效來源 session，可選同一 session 的訂單 |
| 複製剛產生的碼及領取連結 | 允許 | 允許 | 允許 | 前端顯示本次回應的明碼，沒有角色限制 |
| 修改名稱、說明、交付日 | 允許 | 允許 | 允許 | `PUT /art-deliveries/{id}`；沒有建立者／負責人限制 |
| 設為可領取、已領取、取消或重新開啟 | 允許 | 允許 | 允許 | 同一更新 API；所有角色可選五種交付狀態 |
| 上傳作品圖片 | 允許 | 允許 | 允許 | `POST /art-deliveries/{id}/assets/upload` |
| 加入 HTTPS 雲端連結 | 允許 | 允許 | 允許 | `POST /art-deliveries/{id}/assets/link` |
| 移除附件 | 允許 | 允許 | 允許 | `DELETE /art-deliveries/{id}/assets/{assetId}`；軟移除，非刪除整筆作品 |
| 查看後台私密圖片 | 允許 | 允許 | 允許 | `GET /art-deliveries/{id}/assets/{assetId}`；不要求作品已開放 |
| 重發單筆領取碼 | 不允許 | 允許 | 允許 | `POST /art-deliveries/{id}/reissue-code`，額外要求 `AdminManager` |
| 查詢歷史顧客、UID 候選及跨日資料 | 允許 | 允許 | 允許 | `GET /customer-history`、`GET /customer-identity/candidates`、`GET /customers/{uid}` |
| 對未歸戶入場紀錄建立新 UID | 允許 | 允許 | 允許 | `POST /order-sessions/{sessionId}/customer-profile`，不傳既有 UID |
| 手動綁定既有 UID | 不允許 | 允許 | 允許 | 同一 API；service 檢查角色，店員得到 `CUSTOMER_LINK_FORBIDDEN` |

後台 API 的 `/api/admin` 前綴在表格中省略。未登入者不能使用這些 API；有效店員直接呼叫重發端點也會被授權政策拒絕。

來源：API `src/Controllers/Admin/CustomerDeliveryController.cs:9`、`:30`、`:39`、`:47`、`:51`；`src/Services/Customers/CustomerIdentityService.cs:45`；Web `features/admin/deliveries/AdminDeliveriesPage.tsx:30`、`:76`、`features/admin/deliveries/DeliveryEditor.tsx:76`。

## 領取碼與作品歸屬

建立和重發都由 API 產生隨機領取碼。資料庫保存雜湊，不保存可還原的明碼；一般清單／明細回應也不回傳領取碼。因此：

- 初次建立成功後，三種帳號都可看到本次領取碼及複製連結。
- 關閉、重新載入或離開頁面後，不能再讀取原碼；需要有重發權限的帳號產生新碼。
- 重發會覆蓋該筆作品的碼雜湊，舊碼立即失效；目前未見領取碼到期設定。
- 重發不會解除顧客 UID 歸戶。持有有效 UID 者仍可透過 UID 查詢該 UID 已歸戶的作品。
- API 沒有刪除整筆作品或還原舊領取碼的端點；「取消」是作品狀態。

作品資料有來源 session、可選訂單／訂單明細，以及 `CREATED_BY`／`UPDATED_BY` 稽核欄位。現有交付查詢、更新及附件異動不把建立者當成存取條件，也沒有作品負責人欄位或指名人員的授權比對。登入身分帶有 `staff_member_id`，交付流程沒有用它決定可操作作品範圍。

來源：API `src/Services/Customers/ArtDeliveryService.cs:16`、`:37`、`:50`；`src/Repositories/Customers/CustomerDeliveryRepository.Deliveries.cs:21`、`:60`、`:80`、`:97`、`:168`；`db/migrations/20260921_01_customer_commissions.sql:18`。Web `features/admin/customers/IssuedClaimCode.tsx:23`。

## 可能被誤認為權限問題的限制

| 現象／限制 | 目前原因 |
|---|---|
| 截圖「建立作品並產生領取碼」呈灰色 | 名稱空白或請求處理中；前端沒有角色限制 |
| 沒有建立作品表單 | 建立入口需要來源 session，通常從歷史顧客或訂單明細進入 |
| 建立失敗 | session 必須存在；訂單須屬於該 session，指定明細須屬於該訂單；名稱必填、最多 160 字 |
| 尚未歸戶 UID | 不會阻止建立作品或產生單筆領取碼；沒有 UID 時仍可用單筆碼領取 |
| 無法儲存「可領取／已領取」 | 至少需要一個未移除的圖片或連結；前端及 API 都檢查 |
| 儲存時要求重新整理 | 更新版本不符，回傳 `VERSION_CONFLICT`，不是角色拒絕 |
| 已領取／已取消的作品無法新增或移除附件 | API 回傳 `DELIVERY_CLOSED`；須先重新開啟作品，這項限制適用所有帳號 |
| 加入／移除附件後顧客看不到作品附件 | 作品自動回到製作中，需要再次設為可領取 |
| 圖片上傳被拒絕 | 10 MiB、2400 萬畫素以內的靜態 JPEG／PNG／WebP；API 另檢查實際檔案並重編碼；最多 20 個有效附件 |
| 雲端連結被拒絕 | 僅接受符合伺服器檢查的 HTTPS 連結，拒絕帳密、IP／localhost、非預設連接埠等 |
| 複製碼按鈕沒有回饋 | 前端在剪貼簿 API 不存在時直接返回，也沒有處理寫入失敗的顯示訊息；屬於另一個回饋缺口，不能據此判定交付 API 權限不足 |

前端允許顯示已領取／已取消作品的附件異動按鈕，但送出後由 API 拒絕；角色提示、表單停用原因及狀態限制尚未統一呈現。

後台可直接把作品設為「已領取」並記錄時間。因此目前的 `deliveredAt` 不必然表示顧客曾按下確認領取；也可能是店員在後台修改狀態。

來源：Web `features/admin/deliveries/AdminDeliveriesPage.tsx:88`、`features/admin/deliveries/DeliveryEditor.tsx:34`、`:98`、`:127`、`:137`、`features/admin/customers/IssuedClaimCode.tsx:16`；API `src/Repositories/Customers/CustomerDeliveryRepository.Deliveries.cs:63`、`:85`、`:89`、`:112`、`:129`、`src/Services/Customers/ArtDeliveryService.cs:56`、`:68`。

## UID 歸戶的例外與限制

手動綁定既有 UID 需要經理／開發者。不過開立點餐入場紀錄有既定的自動歸戶流程：同遊戲 ID 沒有候選時建立新 UID；只有一個候選時自動沿用；有多個候選時保留未歸戶。這不是交付頁賦予店員手動合併的權限。

已經綁定 UID 的 session 不能直接改綁另一個 UID，即使經理也會得到 `CUSTOMER_ALREADY_LINKED`。單筆領取碼則不要求事先有 UID。

來源：API `src/Services/Customers/CustomerIdentityService.cs:45`、`:57`、`src/Repositories/Customers/CustomerDeliveryRepository.cs:72`。

## 顧客端權限

顧客端不要求後台登入，而以單筆領取碼或有效顧客 UID 授權。兩種方式不能同時提交。

| 授權方式 | 可查詢範圍 | 附件及確認領取 |
|---|---|---|
| 單筆領取碼 | 雜湊相符的一筆作品 | 僅該筆，且狀態須為 `ready`／`delivered` |
| 顧客 UID | 透過 session 明確歸戶至該 UID 的作品 | 僅歸戶作品，且狀態須為 `ready`／`delivered` |
| 遊戲 ID、當日點餐找回碼、session／訂單 ID | 不構成作品領取授權 | 不可用這些資料直接領取 |

尚未開放的作品可透過有效領取方式查詢名稱、說明、狀態等基本資料，但不回傳附件，也不能確認領取。被移除的圖片不會由圖片端點回傳。顧客確認領取會把 `ready` 改為 `delivered`，已領取再確認則保持既有狀態。

UID 是持有式識別：API 驗證 UID 存在及作品歸戶，不會驗證輸入者是顧客本人。HTTPS 雲端檔案的外部分享權限由雲端服務管理，本站只控制何時提供連結；已取得連結的後續外部存取不由本站撤銷。

來源：API `src/Controllers/Client/CustomerDeliveryController.cs:8`、`src/Services/Customers/ArtDeliveryService.cs:106`、`:117`、`:139`、`src/Repositories/Customers/CustomerDeliveryRepository.Deliveries.cs:28`、`:137`、`:149`；Web `docs/customer-commissions.md`。

## 建議調整方向（尚未實作）

1. 保留所有店員建立作品及初次產生領取碼的能力，補上空白名稱的停用說明，以及剪貼簿失敗的可見回饋。
2. 對重發領取碼先明確定義操作範圍：若指名人員應只重發自己負責作品的碼，需建立作品負責人關聯及 API 歸屬檢查，不能只把重發端點改成所有店員可用。
3. 同步決定作品查閱、取消、重新開啟、附件刪除與直接標記已領取的範圍，避免只限制重發而其他操作仍可異動全店作品。
4. 前端及 API 使用一致的能力判斷，並讓按鈕清楚說明是角色、作品狀態、必填欄位或資料更新衝突造成的限制。

這次已完成交付相關前後端規則對照；帳號現況、瀏覽器剪貼簿狀態，以及真實操作是否另有連線／資料錯誤仍需使用者實際請求的證據才能確認。
