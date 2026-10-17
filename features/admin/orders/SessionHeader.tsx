"use client";

import { AdmissionSummary } from "./AdmissionSummary";

import { useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { readCharacterIdentity } from "@/lib/customer-identity";

interface SessionHeaderProps {
  item: {
    session: {
      id: string;
      businessDate: string;
      customerName: string;
      gameId: string;
      status: string;
      remainingMealCredit: number;
      maxNominatedStaff: number;
    };
    orderCount: number;
    totalAmount: number;
  };
  loading: boolean;
  onUpdate: (body: { maxNominatedStaff: number } | { status: string }) => void;
  onReissue: () => void;
  onAssisted: () => void;
}

const money = (value: number) => `${Number(value || 0).toLocaleString("zh-TW")} G`;

export function SessionHeader({ item, onUpdate, onReissue, onAssisted, loading }: SessionHeaderProps) {
  const [max, setMax] = useState(item.session.maxNominatedStaff);
  const active = item.session.status === "active";
  const customerQuery = new URLSearchParams({ session: item.session.id, date: item.session.businessDate });
  const createQuery = new URLSearchParams({ session: item.session.id, date: item.session.businessDate, create: "1" });

  return (
    <header className="adminSelectedCustomer adminOrderCustomerHeader">
      <div className="adminOrderCustomerIdentity">
        <div className="adminOrderCustomerName">
          <h2>{item.session.customerName}</h2>
          <span className={`adminOrderStatus ${active ? "is-in_service" : ""}`}>{active ? "可點餐" : "僅可查看"}</span>
        </div>
        <p>遊戲 ID：{item.session.gameId}</p>
        {!readCharacterIdentity(item.session.gameId) ? <p>伺服器未確認（舊紀錄）</p> : null}
        <p>本營業日共 {item.orderCount} 張訂單</p>
      </div>
      <dl className="adminOrderCustomerMetrics">
        <div><dt>信物餐點餘額</dt><dd>{money(item.session.remainingMealCredit)}</dd></div>
        <div><dt>本營業日消費</dt><dd>{money(item.totalAmount)}</dd></div>
      </dl>
      <div className="adminSessionControls">
        <h3 className="adminOrderCustomerGroupLabel">點餐管理</h3>
        <div className="adminOrderManagementContent">
          <form className="adminOrderNominationControl" onSubmit={(event) => { event.preventDefault(); onUpdate({ maxNominatedStaff: max }); }}>
            <label>同時可指名人數<input type="number" min="0" max="100" required disabled={loading} value={max} onChange={(event) => setMax(Number(event.target.value))} /></label>
            <AdminButton type="submit" variant="secondary" disabled={loading}>儲存人數</AdminButton>
          </form>
          <div className="adminOrderSessionActions">
            <AdminButton disabled={loading || !active} onClick={onAssisted}>代客點餐</AdminButton>
            <AdminButton variant="ghost" disabled={loading} onClick={onReissue}>尋回點餐碼</AdminButton>
            <AdminButton variant={active ? "danger" : "secondary"} disabled={loading} onClick={() => onUpdate({ status: active ? "readonly" : "active" })}>{active ? "顧客離店／停止點餐" : "重開點餐"}</AdminButton>
          </div>
        </div>
      </div>
      <AdmissionSummary sessionId={item.session.id} refreshKey={`${item.orderCount}:${item.totalAmount}`} />
      <nav className="adminOrderCustomerServices" aria-label="目前顧客的服務與查詢">
        <span className="adminOrderCustomerGroupLabel">顧客服務</span>
        <div className="adminCustomerActions">
          <a className="adminButton adminButton-secondary" href={`/admin/deliveries?${createQuery}`}>建立作品交付</a>
          <a className="adminButton adminButton-ghost" href={`/admin/deliveries?${customerQuery}`}>查看作品交付</a>
          <a className="adminButton adminButton-ghost" href={`/admin/order-list?${customerQuery}`}>歷史訂單</a>
        </div>
      </nav>
    </header>
  );
}
