# 角色與伺服器識別

日期：2026-10-16。本次採相容式 API 契約；未部署、未變更正式資料。既有 UID、訂單、作品與點餐憑證均保留。本次不需要 schema migration。

## 輸入與歸戶

- 新 Web 開立點餐碼必填人物 ID、必選角色所屬伺服器，不預選第一個選項。
- 七個選項：伊弗利特、利維坦、奧汀、巴哈姆特、泰坦、迦樓羅、鳳凰。「奧丁」輸入別名統一為「奧汀」。當前造訪的伺服器不作為身分來源。
- 建立及一般找回請求使用 `{ gameId: "菲萊", serverName: "奧汀", ... }`；API 產生 `菲萊@奧汀`，存入現有 `GAME_ID`。候選查詢支援完整 `gameId`，也支援額外 `serverName` 參數。
- 人物名稱收斂前後與連續空白，既有大小寫不敏感比對繼續沿用。`@`／全形 `＠` 後若已有伺服器，須與選單一致；不同時回傳 `GAME_SERVER_MISMATCH`。完整 ID 上限沿用 100 字元。
- 完整 ID 同時用於營業日重複開碼檢查、歷史 UID 候選、自動歸戶、找回與 ID 參考統計。同名不同服分開處理；沒有候選建立 UID，唯一候選沿用，多候選不自動歸戶。
- 查詢使用完整 ID，沒有同名舊資料 fallback。候選查詢中、失敗或輸入不完整時不能開碼；修改人物／伺服器會清除已選 UID 並取消舊查詢。
- 無伺服器的舊紀錄標示「伺服器未確認」。經理可查歷史並在開碼前填入經核對的既有 UID，讓新格式延續舊 UID。店員不能手動指定既有 UID。
- 既有已混合顧客的 UID 不會因此自動拆分；本次未新增已歸戶紀錄的改綁／拆戶功能。

## 舊點餐碼與切換

不批次補寫舊 `GAME_ID`，因為長 token 的加密內容及驗證包含該值。既有網址、找回碼與 UID 作品查詢維持原契約。兩個找回入口共用表單：一般模式必選伺服器；僅在明確切換「舊點餐碼未記錄伺服器」時送出裸 ID＋六位數協助碼，不會由一般模式自動退回同名搜尋。

1. API 先走正常正式發布流程；`OrderingIdentity:RequireServerForNewSessions` 預設 `false`，讓既有正式 Web 仍能開立未帶伺服器的紀錄。這些新建裸 ID 紀錄保持未歸戶，交由人工核對，避免同名自動沿用 UID。
2. Web 先到 `dev`，人工確認同名跨服開碼、首次／唯一／多候選、經理填舊 UID、找回不跨服、舊碼及原點餐網址可用。依儲存庫政策，dev 發布預設只做 build、靜態／設定、部署狀態及 HTTP 可用性檢查，不執行自動化套件。
3. 使用者確認該 dev 版本後，以 `dev` → `main` 手動 PR 推進正式 Web。切換盡量安排在沒有進行中營業期時，避免同營業日同時存在裸 ID 與完整 ID 的兩筆入場。
4. 確認舊 Web 已停止使用後，在 API 設定 `OrderingIdentity__RequireServerForNewSessions=true`（或 JSON 的同名設定）。未帶伺服器的新建請求回傳 `GAME_SERVER_REQUIRED`；舊資料找回仍可使用裸 ID。若回退至舊 Web，先恢復此設定為 `false`。

API 沒有獨立測試主機，Web dev 與正式 Web 共用 API，不能在 Web dev 確認前收緊正式 API 的相容設定。

## 實作入口

- [開碼表單](../features/admin/orders/CreateSessionPanel.tsx)
- [共用欄位](../components/customer/CharacterIdentityFields.tsx)、[Web 正規化](../lib/customer-identity.ts)
- [找回表單](../features/ordering/components/OrderRecoveryForm.tsx)
- [歷史顧客](../features/admin/customers/AdminCustomersPage.tsx)
- API：`src/Services/Customers/CharacterIdentity.cs`、`CustomerIdentityService.cs`、`src/Services/Ordering/OrderingService.cs`。

開碼及找回只是遊戲身分線索，完整 ID 不取代點餐 token、六位數協助碼、後台授權或 UID 作品查詢的既有權限檢查。

## 手動選用的回歸檢查

Web：`node --experimental-strip-types --test tests/customer-identity.test.mjs`。API：在 API 專案執行 `dotnet run --project tests/CharacterIdentity/CharacterIdentity.csproj`。檢查七服同名隔離、別名、貼上衝突、長度邊界及舊資料識別，不連線資料庫，也不驗證正式歸戶資料。這些套件不加入 dev workflow，本次未執行。

開碼元件已抽成 TypeScript；`AdminOrderPassPanels.jsx` 保留原有發碼結果面板，`OrderClient.jsx` 與工作台抽屜僅調整引用及請求接線，避免為本需求遷移整個既有點餐頁。
