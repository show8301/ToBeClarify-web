"use client";

import { AdminButton } from "./AdminButton";
import { AdminPage, AdminPanel } from "./AdminShared.jsx";

export function AdminButtonPreview({ finalizeReason }: { finalizeReason: string }) {
  return <AdminPage title="後台按鈕狀態預覽" description="以下全部是模擬狀態，只供畫面確認；按鈕不會建立訂單、結算或修改資料。">
    <AdminPanel title="可操作、不可操作與處理中">
      <div className="adminPageActions">
        <AdminButton>可操作按鈕</AdminButton>
        <AdminButton disabled disabledReason="請先完成必要設定。">條件不足，禁止操作</AdminButton>
        <AdminButton busy busyLabel="儲存中…">儲存</AdminButton>
        <button type="button" disabled>原生停用按鈕</button>
      </div>
    </AdminPanel>
    <AdminPanel title="停用的結算確認">
      <p id="preview-finalize-reason" className="adminSettlementInlineWarning">{finalizeReason}</p>
      <AdminButton disabled disabledReason={finalizeReason} aria-describedby="preview-finalize-reason">確認正式結算</AdminButton>
    </AdminPanel>
    <AdminPanel title="作品交付控制">
      <div className="adminDeliveryScopes"><button type="button" disabled>交付範圍已停用</button></div>
      <div className="adminDeliveryDetailTabs"><button type="button" disabled>交付頁籤已停用</button></div>
      <button type="button" className="adminDeliveryQueueItem" disabled>交付佇列已停用</button>
    </AdminPanel>
  </AdminPage>;
}
