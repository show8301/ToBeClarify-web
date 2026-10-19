# 補正後重新結算

營運結算的「正式結算」步驟，在班次已正式結算且登入者為經理／開發人員時，顯示「補正後重新結算」與可展開的重新結算紀錄。

按鈕開啟共用 AdminDialog。先讀取唯讀預覽，列出原應付、補正後應付、全員工時及薪資差額；同時提供按既有支付／追回、事後差額計算的待補付或需追回餘額。說明使用 AdminHelp，異常與未知結果直接顯示。

確認需有有效來源預覽、實際異動、零阻擋異常、補正原因及核對勾選。確認中阻止重複提交；網路或伺服器結果不明時保留原操作編號重試。重新讀取預覽會取得當前正式版本；後端再次比對來源及版本，拒絕過期確認。

原因上限 500 字；工時差異保留前後值，長名稱與金額允許換行，表格在窄版可水平捲動。沿用共用按鈕、對話框、字型和明暗主題，僅新增結算層的版面樣式。

依賴 API 的三個新入口：

- POST /api/admin/settlement/recalculation/preview
- POST /api/admin/settlement/recalculation/confirm
- GET /api/admin/settlement/recalculation/history

API 先發布，Web 先進 dev，待使用者確認再由 dev → main。既有正式站不會因本地新增程式自動重算任何班次。完整交易與稽核設計見 API 專案 docs/SETTLEMENT-RECALCULATION.md。
