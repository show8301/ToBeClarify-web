# 後台停用按鈕游標盤點

日期：2026-10-14。範圍：`features/admin` 的按鈕與 Toggle 呼叫、後台載入的 admin／shared CSS，以及根 layout 同時載入的 public CSS。這是原始碼與 CSS 宣告盤點，沒有登入逐頁觸發實際營運操作，也沒有修改結算資格或交易資料。

## 共用的等待游標問題

以下三條原規則把 `disabled` 一律當作等待；本機已全部改成 `not-allowed`，尚未提交或發布：

- [登入主要按鈕](../styles/admin/layers/00-foundation.css)：`.adminPrimaryButton:disabled`。
- [後台共用按鈕](../styles/admin/layers/10-management.css)：`.adminButton:disabled`。
- [結算步驟導覽](../styles/admin/layers/60-settlement.css)：`.adminSettlementStepper > button:disabled`。

因此，不需要每個業務頁面都新增一條覆寫。以下是明確存在「不是正在讀取，而是條件不符」的同類按鈕範例；它們使用相同的共用按鈕樣式，會一起受本機修正涵蓋。

| 範圍 | 按鈕與停用原因 | 原始碼 |
| --- | --- | --- |
| 結算工作臺 | 正式結算資格不足；輸入未保存時不能重新計算；步驟到起點／終點時不可前進或後退 | [SettlementOperations](../features/admin/settlement/SettlementOperations.tsx) |
| 店員營業工作臺 | 開始／完成服務不在允許操作中；不能代點／訂房／續時；仍有進行中服務時不能下班 | [指名工作臺](../features/admin/operations/AdminDesignatedWorkbench.tsx)、[打卡](../features/admin/operations/WorkbenchShiftBar.tsx) |
| 工作臺點餐／加購 | 未選品項、數量不符、購物車空白、剩餘時段不足或操作結果未釐清 | [點餐](../features/admin/operations/WorkbenchOrderComposer.tsx)、[加購](../features/admin/operations/WorkbenchAddonForm.tsx) |
| 點單與營業管理 | 未保存營業計畫時不能開店；拒絕協調單缺少原因；改期或補登缺少必要時間／原因；顧客不是有效入場狀態時不能代客點餐 | [營業計畫](../features/admin/orders/BusinessDayPlanPanel.tsx)、[訂單](../features/admin/orders/AdminOrdersPage.jsx)、[顧客區](../features/admin/orders/SessionHeader.tsx) |
| 菜單設定 | 尚無排序變更，或不具備新版菜單排序能力時不能儲存排序 | [AdminMenuPage](../features/admin/menu/AdminMenuPage.jsx) |
| 店員管理 | 沒有排序變更時不能儲存店員順序 | [AdminStaffSettingsPage](../features/admin/staff/AdminStaffSettingsPage.jsx) |
| 首頁設定 | 尚無可用週報時不能新增週報輪播 | [AdminHomeSettingsPage](../features/admin/home/AdminHomeSettingsPage.jsx) |
| 值班規劃 | 沒有營業日期時不能新增；非管理者不能編輯他人規劃 | [AdminDutyPlanningPage](../features/admin/duty-planning/AdminDutyPlanningPage.tsx) |
| 週報管理 | 未變更週報順序時不能儲存 | [AdminEventsPage](../features/admin/events/AdminEventsPage.jsx) |
| 作品交付 | 標題空白、缺少檔案／連結、沒有領取碼查看資格、工作區不可用、未保存變更或負責人未變更 | [建立作品](../features/admin/deliveries/CreateDeliveryPanel.tsx)、[領取碼](../features/admin/deliveries/DeliveryCredentials.tsx)、[交付詳情](../features/admin/deliveries/DeliveryDetail.tsx)、[作品編輯](../features/admin/deliveries/DeliveryEditor.tsx) |
| 圖片操作 | 尚無圖片時不能調整／刪除；未建立裁切範圍時不能套用 | [頭像](../features/admin/media/AdminAvatarPicker.jsx)、[裁切](../features/admin/media/AdminImageProcessingProvider.jsx) |
| 驗證碼工具 | 沒有可複製的密碼重設驗證碼時不能複製 | [AdminCredentialTools](../features/admin/dashboard/AdminCredentialTools.jsx) |

自動解析 JSX／TSX 找到 261 個具有明確 `disabled` prop 的 button／AdminButton／AdminRefreshButton／AdminToggle 呼叫，其中 200 個使用共用按鈕。這是程式呼叫點數量，包含預覽與真正處理中等情境，不是 200 個缺陷，也不是同時可見的按鈕數。繼承 fieldset 停用狀態的按鈕同樣受 `:disabled` 影響，未列入這個呼叫點統計。

## 原本已有正確覆寫的範圍

- [通知中心樣式](../styles/admin/layers/70-notifications.css)：`.notification-page button:disabled` 使用 `not-allowed`，其 specificity 高於共用規則。因此，通知規則保存、複製、音效上傳等雖使用共用元件，在通知頁面中不能直接判為等待游標缺陷。
- [留言板樣式](../styles/admin/layers/90-guestbook.css)：`.adminGuestbook :is(button, .adminButton):disabled` 及 drawer 對應規則使用 `not-allowed`。
- 共用 Toggle、結算上層頁籤、舊加購 composer 的送出按鈕及 Base UI disabled 選單項目已有禁止游標。
- 共用「重整」按鈕沒有「只要 disabled 就播放旋轉動畫」的實作；其箭頭是靜態文字圖示。按鈕游標仍依所在頁面的 CSS cascade 決定。

## 另有停用提示不一致，尚未修改

| 位置 | 宣告／缺口 | 結果 |
| --- | --- | --- |
| 作品交付的範圍選擇、詳情頁籤 | [92-delivery-workspace.css](../styles/admin/layers/92-delivery-workspace.css) 的 `.adminDeliveryScopes > button:disabled, .adminDeliveryDetailTabs > button:disabled` 為 `cursor: default` | 停用時為普通箭頭，未顯示禁止 |
| 作品交付佇列卡片 | 同檔 `.adminDeliveryQueueItem:disabled` 為 `cursor: default` | 停用時為普通箭頭 |
| 作品交付狀態操作 | [DeliveryDetail](../features/admin/deliveries/DeliveryDetail.tsx) 的原生狀態按鈕未使用 `.adminButton`，沒有專屬停用游標宣告 | 可能沿用 `.adminTheme button` 的手型游標 |
| 分項履約操作 | [OrderFulfillmentPanel](../features/admin/orders/OrderFulfillmentPanel.tsx) 的原生操作按鈕未使用共用按鈕，沒有專屬停用游標宣告 | 原因未填或預覽不能開始時，仍可能沿用手型 |
| 圖片放大檢視控制 | [公開共用基底](../styles/public/layers/00-foundation.css) 的 `.zoom-photo-controls button:disabled` 為 `cursor: default` | 達到縮放上下限時顯示普通箭頭；屬跨頁共用控制 |

以上是同一份「停用要可辨識」原則的其他缺口，沒有誤設成 `wait`，不與等待游標缺陷混計。

## 檢查限制與發布狀態

本節保留盤點完成時的紀錄。後續已依使用者要求統一共用狀態與補齊原生控制，最新實作見 [後台按鈕狀態標準](admin-button-states.md)；目前仍是本機修改，尚未發布。

- 使用 TypeScript parser 解析按鈕呼叫、PostCSS 解析 selector／declaration；不是只用文字是否含 `wait` 判定。
- public CSS 尚有 `.guest-composer` 等舊留言樣式及 `.collectionPage button:disabled` 的等待游標，未找到它們用於目前後台頁面，屬後台範圍之外。
- 三條共用修正已經過 production build、本地載入 CSS 解析檢查，3/3 符合 `not-allowed`。3001 的匿名管理代理回應 401，字型 CSS、變數及資源檢查通過。
- 實際 hover 游標、Computed 與 Rendered Fonts 尚未逐頁確認。既有 CSS 檢查工具的 URL 模式只支援本機，本次遠端 CSS 核對未執行成功；不能把它當作正式／測試站的現場驗收。
- 本次盤點沒有另外修改按鈕或發布；先前的三個游標修正仍僅在本機，兩個已部署環境尚未套用。
