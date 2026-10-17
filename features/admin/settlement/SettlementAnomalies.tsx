import { useRef, useState } from "react";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { settlementMoney as money } from "./presentation";
import type { SettlementOverview, SettlementStaff } from "./types";

type Props = {
  overview: SettlementOverview;
  staff: SettlementStaff[];
  onAttendance: () => void;
  saving: boolean;
  onRefresh: () => Promise<boolean>;
};

const staffAnomalyHelp: Record<string, string> = {
  DESIGNATED_INPUT_MISSING: "請核對出勤與計薪輸入。此為舊版指名角色檢核；新版應依上班時鎖定的主要計薪職位處理，不需為支援服務另加指名角色。",
  PAYROLL_INPUT_MISSING: "請核對出勤、上班計薪職位及既有輸入，保存後重新檢核。支援服務不會改變主要計薪職位，不需為服務所得另加指名角色。",
  PAYROLL_ROLE_UNRESOLVED: "請由經理在出勤區確認上班計薪職位，再核對並保存計薪輸入。",
  PAYROLL_INPUT_CONFLICT: "請依上班時鎖定的計薪職位核對輸入，移除衝突列後保存；支援服務不會改變主要職位。",
  BACKSTAGE_NOT_ALLOWED: "幕後參與僅限上班時具開發資格的人員，請核對出勤資格及幕後計薪輸入。",
  PAYROLL_SNAPSHOT_CHANGED: "上班計薪職位已確認或更正，請核對最新職位與計薪輸入，重新保存後檢核。",
  DESIGNATED_TIP_DUPLICATED: "請核對相關訂單的小費來源及此人員的收入列，排除重複分配後重新計算。",
  EVENT_ATTENDANCE_NOT_VERIFIED: "請核對打卡或補打卡申請；活動日出席須有打卡或已核准的補打卡資料。",
};

export function SettlementAnomalies({ overview, staff, onAttendance, saving, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const refresh = async () => {
    if (saving || refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try { await onRefresh(); }
    finally { refreshLock.current = false; setRefreshing(false); }
  };
  const backstage = overview.staffInputs.filter(item => item.role === "backstage");
  const participants = backstage.filter(item => item.isBackstageParticipant);

  return <AdminPanel title={<>
    {overview.anomalies.length ? `需處理的結算異常 · ${overview.anomalies.length} 項` : "結算異常檢核 · 0 項"}
    <AdminHelp title="結算異常檢核說明">重新檢核會依最新出勤與上班計薪職位帶入預覽；自動帶入的輸入會在保存或重新計算時儲存。尚未保存的人工修改不納入檢核。異常會阻止正式結算。</AdminHelp>
  </>} className="adminSettlementAnomalies"
    actions={<AdminButton variant="secondary" busy={refreshing} busyLabel="重新檢核中…" disabled={saving} onClick={() => void refresh()}>重新檢核</AdminButton>}>
    {!overview.anomalies.length ? <p className="adminSettlementHint" role="status">目前沒有需處理的結算異常。</p> : <ul>{overview.anomalies.map((item, index) => {
      const staffIssue = Object.hasOwn(staffAnomalyHelp, item.code);
      const backstageMissing = item.code === "BACKSTAGE_DENOMINATOR_ZERO";
      const staffName = [item.staffName,
        staff.find(member => member.id === item.sourceId)?.displayName,
        overview.payrollAssignments?.find(member => member.staffId === item.sourceId)?.displayName,
        overview.staffInputs.find(input => input.staffId === item.sourceId)?.displayName,
        overview.results.find(result => result.staffId === item.sourceId)?.displayName,
      ].map(name => name?.trim()).find(name => name && name !== item.sourceId);
      const orders = item.orders ? [...new Map(item.orders.map(order => [order.orderId, order])).values()] : null;
      return <li key={`${item.code}-${item.sourceId || index}`}>
        <strong>{staffIssue ? `${staffName || "姓名未提供"}：${item.message}` : backstageMissing ? "幕後技術分潤尚無參與人員" : item.message}</strong>
        {staffIssue ? <AdminHelp title="異常處理說明">{staffAnomalyHelp[item.code]}</AdminHelp> : null}
        {backstageMissing ? <>
          <p className="adminSettlementHint">幕後技術池 {money(overview.summary.backstagePool)} G 待分配；本次結算預覽的幕後技術角色 {backstage.length} 人，其中勾選「幕後參與」{participants.length} 人。</p>
          <AdminHelp title="幕後技術分配說明">分配人數只計入角色為「幕後技術」且勾選「幕後參與」的結算輸入，不以全店人員名單或打卡人數計算。請到出勤核對實際參與人員，保存後重新計算。若當日確實無人參與，需先確認分潤規則，系統不會自動分配給其他角色。</AdminHelp>
        </> : item.sourceId && !(staffIssue && staffName) ? <p className="adminSettlementHint">{staffIssue ? "人員識別碼" : "來源識別碼"}：{item.sourceId}</p> : null}
        {staffIssue || orders ? <div className="adminSettlementInlineActions" aria-label="相關訂單">
          <span>相關訂單：</span>
          {orders?.length ? orders.map(order => <a key={order.orderId} className="adminButton adminButton-ghost"
            href={`/admin/notifications/orders/${encodeURIComponent(order.orderId)}`} target="_blank" rel="noopener noreferrer"
            aria-label={`查看訂單 ${order.orderNumber || order.orderId}（另開分頁）`}>
            {order.orderNumber || `未提供單號（${order.orderId}）`}
          </a>) : <span className="adminSettlementHint">{orders ? "找不到可辨識的來源訂單，請核對原始交易資料。" : "來源訂單明細未提供，目前無法列出單號。"}</span>}
        </div> : null}
        {staffIssue || backstageMissing ? <AdminButton variant="ghost" disabled={saving} onClick={onAttendance}>前往出勤核對與計薪輸入</AdminButton> : null}
      </li>;
    })}</ul>}
  </AdminPanel>;
}
