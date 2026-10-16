import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { WorkbenchShiftBar } from "./WorkbenchShiftBar";
import type {
  CurrentAdminUser,
  OperationsAction,
  OperationsActionState,
  OperationsData,
  OperationsOrder,
} from "./operationsTypes";
import { formatDateTime, formatMoney, intakeModeLabel } from "./operationsFormat";

type DashboardProps = {
  data: OperationsData;
  user: CurrentAdminUser;
  navigate: (route: string) => void;
  runAction: OperationsAction;
  actionState: OperationsActionState;
  onOpenCreatePass: () => void;
  onOpenCreateRoomService: () => void;
  onChanged?: () => Promise<void>;
};

type Metric = { label: string; value: string | number; detail: string };

function Metrics({ items }: { items: Metric[] }) {
  return <div className="adminRoleDashboardMetrics">{items.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div>;
}

function EmptyState({ children }: { children: string }) {
  return <p className="adminRoleDashboardEmpty">{children}</p>;
}

function ActionFeedback({ state }: { state: OperationsActionState }) {
  if (state.error) return <div className="adminOrderMessage isError" role="alert">{state.error}</div>;
  if (state.message) return <div className="adminOrderMessage" role="status">{state.message}</div>;
  return null;
}

function OrderIdentity({ order, compact = false }: { order: OperationsOrder; compact?: boolean }) {
  return <div className="adminRoleDashboardIdentity"><strong>{order.customerName || "未命名顧客"}</strong><small>{compact ? order.orderNumber : `${order.orderNumber} · ID ${order.gameId}`}</small></div>;
}

function CoordinationRow({ order, runAction, actionState }: { order: OperationsOrder; runAction: OperationsAction; actionState: OperationsActionState }) {
  const acceptActionId = `coordination-accept-${order.id}`;
  const rejectActionId = `coordination-reject-${order.id}`;
  const isBusy = actionState.busyId === acceptActionId || actionState.busyId === rejectActionId;
  const reject = () => {
    if (!window.confirm("確定拒絕此協調單？")) return;
    void runAction(rejectActionId, () => adminApi.decideStoreConfirmation(order.id, "rejected", "現場確認暫時無法承接"), "已拒絕協調單；顧客會收到店家目前無法承接的結果。");
  };
  return <article className="adminRoleDashboardRow">
    <OrderIdentity order={order} compact />
    <div className="adminRoleDashboardRowCopy"><strong>協調單待確認</strong><small>{order.queueStage || "等待店家確認"}</small></div>
    <div className="adminCoordinationActions" role="group" aria-label={`${order.customerName || "此顧客"}協調單處理`}>
      <AdminButton className="adminIconButton adminCoordinationAccept" disabled={isBusy} aria-label="接受協調單" title="接受協調單" onClick={() => void runAction(acceptActionId, () => adminApi.decideStoreConfirmation(order.id, "approved", "現場確認可承接"), "已接受協調單；指名服務會接續等待各店員確認。")}>{actionState.busyId === acceptActionId ? "…" : "✓"}</AdminButton>
      <AdminButton variant="danger" className="adminIconButton adminCoordinationReject" disabled={isBusy} aria-label="拒絕協調單" title="拒絕協調單" onClick={reject}>{actionState.busyId === rejectActionId ? "…" : "×"}</AdminButton>
    </div>
  </article>;
}

export function AdminServiceDashboard({ data, user, navigate, runAction, actionState, onChanged, disabled }: Omit<DashboardProps, "user" | "onOpenCreatePass" | "onOpenCreateRoomService" | "onChanged"> & { user?: CurrentAdminUser; onChanged: () => Promise<void>; disabled: boolean }) {
  const coordinationOrders = data.orders.filter((order) => order.storeConfirmationStatus === "pending");
  const waitingSessions = data.sessions.filter((session) => session.waitingOrderCount > 0);
  const roomOrders = data.roomOrders.filter((order) => !["completed", "cancelled"].includes(order.status)).sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()).slice(0, 6);
  const waitingCount = data.context?.waitingOrderCount ?? data.sessions.reduce((total, session) => total + session.waitingOrderCount, 0);
  return <div className="adminRoleDashboard adminRoleDashboard-service">
    <Metrics items={[
      { label: "待處理訂單", value: waitingCount, detail: "需要現場接手或確認" },
      { label: "協調單", value: coordinationOrders.length, detail: "等待店家承接" },
      { label: "包廂服務", value: roomOrders.length, detail: "尚未完成的服務時段" },
      { label: "開啟中的顧客", value: data.context?.openSessionCount ?? data.sessions.length, detail: intakeModeLabel(data.context?.intakeMode || "") },
    ]} />
    <WorkbenchShiftBar businessDate={data.context?.referenceBusinessDate || ""} staffId={user?.staffMemberId || ""} name={user?.displayName || "我的出勤"} periodStatus={data.context?.periodStatus || ""} disabled={disabled || Boolean(actionState.busyId)} onChanged={onChanged} />
    <ActionFeedback state={actionState} />
    <AdminPanel className="adminRoleDashboardServiceCoordination" title="現場待辦" description="先處理協調單，再依顧客或訂單進入完整操作。">
        <div className="adminRoleDashboardRows">
          {coordinationOrders.map((order) => <CoordinationRow key={order.id} order={order} runAction={runAction} actionState={actionState} />)}
          {waitingSessions.slice(0, 6).map((session) => <article className="adminRoleDashboardRow" key={session.id}><div className="adminRoleDashboardIdentity"><strong>{session.customerName || "未命名顧客"}</strong><small>ID {session.gameId} · {session.orderCount} 張訂單</small></div><div className="adminRoleDashboardRowCopy"><strong>{session.waitingOrderCount} 張待處理</strong><small>{formatMoney(session.totalAmount)} · 最後下單 {formatDateTime(session.lastOrderedAt)}</small></div><span className="adminRoleDashboardBadge">待接手</span></article>)}
          {!coordinationOrders.length && !waitingSessions.length ? <EmptyState>目前沒有需要現場接手的訂單。</EmptyState> : null}
        </div>
    </AdminPanel>
    <AdminPanel className="adminRoleDashboardServiceQuickLinks" title="現場快速入口" description="需要查看完整資料時，再進入原本的管理畫面。" actions={<><AdminButton onClick={() => navigate("/admin/orders")}>完整訂單</AdminButton><AdminButton variant="secondary" onClick={() => navigate("/admin/rooms/service")}>包廂訂購</AdminButton><AdminButton variant="ghost" onClick={() => navigate("/admin/order-list")}>查詢訂單</AdminButton></>} />
  </div>;
}

export { AdminManagerDashboard } from "./AdminManagerWorkbench";
