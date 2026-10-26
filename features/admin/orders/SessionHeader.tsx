"use client";

import { AdmissionSummary } from "./AdmissionSummary";

import { useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { readCharacterIdentity } from "@/lib/customer-identity";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { Save } from "lucide-react";

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
  onBackfill: () => void;
}

const money = (value: number) => `${Number(value || 0).toLocaleString("zh-TW")} G`;

export function SessionHeader({ item, onUpdate, onReissue, onAssisted, onBackfill, loading }: SessionHeaderProps) {
  const [max, setMax] = useState(item.session.maxNominatedStaff);
  const active = item.session.status === "active";
  const customerQuery = new URLSearchParams({ session: item.session.id, date: item.session.businessDate });
  const createQuery = new URLSearchParams({ session: item.session.id, date: item.session.businessDate, create: "1" });

  return (
    <header id="admin-order-customer" className="adminSelectedCustomer adminOrderCustomerHeader">
      <a className="adminButton adminButton-ghost adminOrderMobileJump" href="#admin-order-customers">返回顧客清單</a>
      <div className="adminOrderCustomerIdentity">
        <div className="adminOrderCustomerProfile">
          <div className="adminOrderCustomerName">
            <h2>{item.session.customerName}</h2>
            <span className={`adminOrderStatus ${active ? "is-in_service" : ""}`}>{active ? "可點餐" : "僅可查看"}</span>
          </div>
          <span className="adminOrderCustomerGameIdLabel">遊戲 ID</span>
          <strong className="adminOrderCustomerGameId">{item.session.gameId}</strong>
          {!readCharacterIdentity(item.session.gameId) ? <span className="adminOrderCustomerIdentityWarning">伺服器未確認（舊紀錄）</span> : null}
        </div>
      </div>
      <dl className="adminOrderCustomerMetrics">
        <div className="adminOrderCustomerCount"><dt>本營業日訂單</dt><dd>{item.orderCount.toLocaleString("zh-TW")}<span>張</span></dd></div>
        <div><dt>信物餐點餘額</dt><dd>{money(item.session.remainingMealCredit)}</dd></div>
        <div><dt>本營業日消費</dt><dd>{money(item.totalAmount)}</dd></div>
      </dl>
      <div className="adminOrderCustomerPanels">
        <AdmissionSummary sessionId={item.session.id} refreshKey={`${item.orderCount}:${item.totalAmount}`} />
        <div className="adminOrderCustomerTools">
          <section className="adminSessionControls adminCustomerSummaryCard" aria-label="點餐管理">
            <div className="adminOrderManagementContent">
              <div className="adminFieldHeading">
                <h3 className="adminOrderCustomerGroupLabel">點餐管理</h3>
                <AdminHelp title="點餐管理說明">設定顧客同時可指名的人數，並管理代客點餐、點餐碼與點餐開放狀態。</AdminHelp>
              </div>
              <form className="adminOrderNominationControl" onSubmit={(event) => { event.preventDefault(); onUpdate({ maxNominatedStaff: max }); }}>
                <label>同時可指名人數<input type="number" min="0" max="100" required disabled={loading} value={max} onChange={(event) => setMax(Number(event.target.value))} /></label>
                <AdminButton type="submit" variant="secondary" className="iconActionButton" aria-label="儲存同時可指名人數" title="儲存同時可指名人數" disabled={loading}><Save aria-hidden="true" /></AdminButton>
              </form>
            </div>
            <div className="adminOrderSessionActions">
              <AdminButton disabled={loading || !active} onClick={onAssisted}>代客點餐</AdminButton>
              <AdminButton variant="secondary" disabled={loading || !["active", "readonly"].includes(item.session.status)} onClick={onBackfill}>補登已成交訂單</AdminButton>
              <AdminButton variant="ghost" disabled={loading} onClick={onReissue}>尋回點餐碼</AdminButton>
              <AdminButton variant={active ? "danger" : "secondary"} disabled={loading} onClick={() => onUpdate({ status: active ? "readonly" : "active" })}>{active ? "顧客離店／停止點餐" : "重開點餐"}</AdminButton>
            </div>
          </section>
          <nav className="adminOrderCustomerServices adminCustomerSummaryCard" aria-label="目前顧客的服務與查詢">
            <span className="adminOrderCustomerGroupLabel">顧客服務</span>
            <div className="adminCustomerActions">
              <a className="adminButton adminButton-secondary" href={`/admin/deliveries?${createQuery}`}>建立作品</a>
              <a className="adminButton adminButton-ghost" href={`/admin/deliveries?${customerQuery}`}>查看作品</a>
              <a className="adminButton adminButton-ghost" href={`/admin/order-list?${customerQuery}`}>歷史訂單</a>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
