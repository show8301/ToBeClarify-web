import { useRef, useState } from "react";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { settlementMoney as money } from "./presentation";
import type { SettlementOverview, SettlementStaff } from "./types";

type Props = {
  overview: SettlementOverview;
  staff: SettlementStaff[];
  onAttendance: () => void;
  saving: boolean;
  onRefresh: () => Promise<boolean>;
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

  return <AdminPanel title={overview.anomalies.length ? `需處理的結算異常 · ${overview.anomalies.length} 項` : "結算異常檢核 · 0 項"} description="重新檢核會讀取已保存的最新資料並更新異常與金額預覽；尚未保存的輸入會保留，但不納入檢核。異常會阻止正式結算。" className="adminSettlementAnomalies"
    actions={<AdminButton variant="secondary" busy={refreshing} busyLabel="重新檢核中…" disabled={saving} onClick={() => void refresh()}>重新檢核</AdminButton>}>
    {!overview.anomalies.length ? <p className="adminSettlementHint" role="status">目前沒有需處理的結算異常。</p> : <ul>{overview.anomalies.map((item, index) => {
      const designated = item.code === "DESIGNATED_INPUT_MISSING";
      const backstageMissing = item.code === "BACKSTAGE_DENOMINATOR_ZERO";
      const staffName = staff.find(member => member.id === item.sourceId)?.displayName
        || item.staffName || overview.results.find(result => result.staffId === item.sourceId)?.displayName;
      return <li key={`${item.code}-${item.sourceId || index}`}>
        <strong>{designated ? `${staffName || "無法辨識姓名的人員"}：尚未建立「指名人員」結算角色` : backstageMissing ? "幕後技術分潤尚無參與人員" : item.message}</strong>
        {designated ? <>
          <p className="adminSettlementHint">此人員有指名營業額或指定小費，但尚未建立「指名人員」角色的計薪輸入。補登出勤不會自動新增結算角色；請在「計薪輸入與人員角色」選擇此人員的「指名人員」角色並保存，出勤分鐘才會帶入。其他角色的輸入不會計入。</p>
          {!staffName ? <p className="adminSettlementHint">人員識別碼：{item.sourceId}</p> : null}
          <p className="adminSettlementHint">相關訂單：{item.orders?.length
            ? item.orders.map(order => order.orderNumber || `未提供單號（${order.orderId}）`).join("、")
            : item.orders ? "找不到可辨識的來源訂單，請核對原始交易資料。" : "來源訂單明細尚未提供，目前無法列出單號。"}</p>
        </> : backstageMissing ? <>
          <p className="adminSettlementHint">幕後技術池 {money(overview.summary.backstagePool)} G 待分配；已保存的幕後技術角色 {backstage.length} 人，其中勾選「幕後參與」{participants.length} 人。</p>
          <p className="adminSettlementHint">分配人數只計入角色為「幕後技術」且勾選「幕後參與」的結算輸入，不以全店人員名單或打卡人數計算。請到出勤核對新增或核對實際參與人員，保存後重新計算。若當日確實無人參與，需先確認分潤規則，系統不會自動分配給其他角色。</p>
        </> : item.sourceId ? <p className="adminSettlementHint">來源識別碼：{item.sourceId}</p> : null}
        {designated || backstageMissing ? <AdminButton variant="ghost" disabled={saving} onClick={onAttendance}>前往出勤核對與計薪輸入</AdminButton> : null}
      </li>;
    })}</ul>}
  </AdminPanel>;
}
