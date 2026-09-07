import { useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import type {
  CurrentAdminUser,
  OperationsAction,
  OperationsActionState,
  OperationsContext,
  OperationsData,
  OperationsOrder,
  OperationsRoomOrder,
} from "./operationsTypes";
import { formatClock, formatDateTime, formatMoney, intakeModeLabel, orderStatusLabel, periodStatusLabel, roomStatusLabel } from "./operationsFormat";

type DashboardProps = {
  data: OperationsData;
  user: CurrentAdminUser;
  navigate: (route: string) => void;
  runAction: OperationsAction;
  actionState: OperationsActionState;
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

function OrderIdentity({ order }: { order: OperationsOrder }) {
  return <div className="adminRoleDashboardIdentity"><strong>{order.customerName || "未命名顧客"}</strong><small>{order.orderNumber} · ID {order.gameId}</small></div>;
}

function AssignedServiceRow({ order, nominee, runAction, actionState }: { order: OperationsOrder; nominee: OperationsOrder["nominees"][number]; runAction: OperationsAction; actionState: OperationsActionState }) {
  const actionId = `nominee-${order.id}`;
  const waitingForStore = order.storeConfirmationStatus === "pending";
  const canConfirm = nominee.confirmationStatus === "waiting" && !waitingForStore;
  return <article className="adminRoleDashboardRow">
    <OrderIdentity order={order} />
    <div className="adminRoleDashboardRowCopy"><strong>{nominee.serviceName}</strong><small>{formatDateTime(nominee.requestedStartsAt)} ～ {formatClock(nominee.busyUntil)} · {nominee.segmentCount} 節</small></div>
    <span className="adminRoleDashboardBadge">{waitingForStore ? "等待店家確認" : nominee.confirmationStatus === "waiting" ? "等我確認" : orderStatusLabel(order.status)}</span>
    {canConfirm ? <AdminButton variant="secondary" disabled={actionState.busyId === actionId} onClick={() => void runAction(actionId, () => adminApi.confirmNominee(order.id), "已確認自己的指名；訂單會等待其他被指名店員完成確認。")}>{actionState.busyId === actionId ? "處理中…" : "確認我的指名"}</AdminButton> : null}
  </article>;
}

function AssignedAddonRow({ order, addon, runAction, actionState }: { order: OperationsOrder; addon: OperationsOrder["addons"][number]; runAction: OperationsAction; actionState: OperationsActionState }) {
  const actionId = `addon-${order.id}`;
  return <article className="adminRoleDashboardRow">
    <OrderIdentity order={order} />
    <div className="adminRoleDashboardRowCopy"><strong>附掛加購：{addon.serviceName}</strong><small>{addon.staffName} · 既有指名服務中的加購</small></div>
    <span className="adminRoleDashboardBadge">{addon.status === "waiting" ? "等我確認" : orderStatusLabel(addon.status)}</span>
    {addon.status === "waiting" ? <AdminButton variant="secondary" disabled={actionState.busyId === actionId} onClick={() => void runAction(actionId, () => adminApi.confirmAddon(order.id), "已確認顧客送出的附掛加購服務單。")}>{actionState.busyId === actionId ? "處理中…" : "確認加購服務"}</AdminButton> : null}
  </article>;
}

export function AdminDesignatedDashboard({ data, user, navigate, runAction, actionState }: DashboardProps) {
  const assigned = data.orders.flatMap((order) => order.nominees.filter((nominee) => nominee.staffId === user.staffMemberId).map((nominee) => ({ order, nominee })));
  const addons = data.orders.flatMap((order) => order.addons.filter((addon) => addon.staffId === user.staffMemberId).map((addon) => ({ order, addon })));
  const waiting = assigned.filter(({ order, nominee }) => nominee.confirmationStatus === "waiting" && order.storeConfirmationStatus !== "pending");
  const active = assigned.filter(({ order }) => ["confirmed", "in_service"].includes(order.status));
  const upcoming = assigned.filter(({ order }) => ["completed", "cancelled", "rejected"].includes(order.status) === false).sort((left, right) => new Date(left.nominee.requestedStartsAt).getTime() - new Date(right.nominee.requestedStartsAt).getTime()).slice(0, 6);

  return <div className="adminRoleDashboard adminRoleDashboard-designated">
    <Metrics items={[
      { label: "待我確認", value: waiting.length, detail: "需要現在回應的指名" },
      { label: "服務中／已成立", value: active.length, detail: "我的今日服務" },
      { label: "今日指名", value: assigned.length, detail: "包含已完成與進行中" },
      { label: "目前接單", value: intakeModeLabel(data.context?.intakeMode || ""), detail: periodStatusLabel(data.context?.periodStatus || "") },
    ]} />
    {!user.staffMemberId ? <div className="adminRoleDashboardNotice" role="alert">目前帳號尚未綁定店員資料，因此無法篩出個人指名。請先請經理在店員資料設定中確認綁定。</div> : null}
    <ActionFeedback state={actionState} />
    <div className="adminRoleDashboardGrid">
      <AdminPanel title="現在需要我處理" description="顧客指名與附掛加購會在這裡集中出現。">
        <div className="adminRoleDashboardRows">
          {waiting.map(({ order, nominee }) => <AssignedServiceRow key={`${order.id}-${nominee.id}`} order={order} nominee={nominee} runAction={runAction} actionState={actionState} />)}
          {addons.filter(({ addon }) => addon.status === "waiting").map(({ order, addon }) => <AssignedAddonRow key={`${order.id}-${addon.id}`} order={order} addon={addon} runAction={runAction} actionState={actionState} />)}
          {!waiting.length && !addons.some(({ addon }) => addon.status === "waiting") ? <EmptyState>目前沒有需要你立即確認的服務。</EmptyState> : null}
        </div>
      </AdminPanel>
      <AdminPanel title="我的今日排程" description="依預約開始時間排列，方便掌握下一位顧客。" actions={<AdminButton variant="ghost" onClick={() => navigate("/admin/orders")}>查看完整訂單</AdminButton>}>
        <div className="adminRoleDashboardRows">
          {upcoming.map(({ order, nominee }) => <article className="adminRoleDashboardRow" key={`${order.id}-${nominee.id}`}><OrderIdentity order={order} /><div className="adminRoleDashboardRowCopy"><strong>{nominee.serviceName}</strong><small>{formatDateTime(nominee.requestedStartsAt)} ～ {formatClock(nominee.requestedServiceEndsAt)}</small></div><span className="adminRoleDashboardBadge">{orderStatusLabel(order.status)}</span></article>)}
          {!upcoming.length ? <EmptyState>目前沒有可顯示的指名排程。</EmptyState> : null}
        </div>
      </AdminPanel>
    </div>
    <AdminPanel title="工作入口" description="只保留現場最常用的操作。">
      <div className="adminRoleDashboardQuickLinks"><AdminButton onClick={() => navigate("/admin/orders")}>查看我的訂單</AdminButton><AdminButton variant="secondary" onClick={() => navigate("/admin/rooms/service")}>查看包廂排程</AdminButton><AdminButton variant="ghost" onClick={() => navigate("/admin/staff")}>更新我的上班狀態</AdminButton></div>
    </AdminPanel>
  </div>;
}

function CoordinationRow({ order, runAction, actionState }: { order: OperationsOrder; runAction: OperationsAction; actionState: OperationsActionState }) {
  const actionId = `coordination-${order.id}`;
  return <article className="adminRoleDashboardRow">
    <OrderIdentity order={order} />
    <div className="adminRoleDashboardRowCopy"><strong>協調單待確認</strong><small>{order.customerNote || "顧客已送出訂單，請現場確認是否承接。"}</small></div>
    <span className="adminRoleDashboardBadge">{order.queueStage || "協調接單"}</span>
    <AdminButton disabled={actionState.busyId === actionId} onClick={() => void runAction(actionId, () => adminApi.decideStoreConfirmation(order.id, "approved", "現場確認可承接"), "已接受協調單；指名服務會接續等待各店員確認。")}>{actionState.busyId === actionId ? "處理中…" : "接受協調單"}</AdminButton>
  </article>;
}

function RoomServiceRow({ order }: { order: OperationsRoomOrder }) {
  return <article className="adminRoleDashboardRow"><div className="adminRoleDashboardIdentity"><strong>{order.roomName}</strong><small>{formatDateTime(order.startsAt)} ～ {formatClock(order.endsAt)} · {order.segmentCount} 節</small></div><div className="adminRoleDashboardRowCopy"><strong>{order.note || "包廂服務"}</strong><small>{formatMoney(order.totalAmount)}</small></div><span className="adminRoleDashboardBadge">{roomStatusLabel(order.status)}</span></article>;
}

export function AdminServiceDashboard({ data, navigate, runAction, actionState }: Omit<DashboardProps, "user"> & { user?: CurrentAdminUser }) {
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
    <ActionFeedback state={actionState} />
    <AdminPanel className="adminRoleDashboardPrimaryAction" title="第一個流程：發點餐碼" description="顧客入場後，先建立本次點餐工作階段，再把點餐碼交給顧客。"><div className="adminRoleDashboardPrimaryActionBody"><div><strong>顧客到了嗎？先發點餐碼</strong><small>建立顧客工作階段後，後續訂單與現場待辦才會集中到今天的工作台。</small></div><AdminButton onClick={() => navigate("/admin/orders?focus=create")}>發點餐碼</AdminButton></div></AdminPanel>
    <div className="adminRoleDashboardGrid">
      <AdminPanel title="現場待辦" description="先處理協調單，再依顧客或訂單進入完整操作。">
        <div className="adminRoleDashboardRows">
          {coordinationOrders.map((order) => <CoordinationRow key={order.id} order={order} runAction={runAction} actionState={actionState} />)}
          {waitingSessions.slice(0, 6).map((session) => <article className="adminRoleDashboardRow" key={session.id}><div className="adminRoleDashboardIdentity"><strong>{session.customerName || "未命名顧客"}</strong><small>ID {session.gameId} · {session.orderCount} 張訂單</small></div><div className="adminRoleDashboardRowCopy"><strong>{session.waitingOrderCount} 張待處理</strong><small>{formatMoney(session.totalAmount)} · 最後下單 {formatDateTime(session.lastOrderedAt)}</small></div><span className="adminRoleDashboardBadge">待接手</span></article>)}
          {!coordinationOrders.length && !waitingSessions.length ? <EmptyState>目前沒有需要現場接手的訂單。</EmptyState> : null}
        </div>
      </AdminPanel>
      <AdminPanel title="包廂服務排程" description="掌握即將開始與服務中的包廂。" actions={<AdminButton variant="ghost" onClick={() => navigate("/admin/rooms/service")}>開啟完整排程</AdminButton>}>
        <div className="adminRoleDashboardRows">{roomOrders.map((order) => <RoomServiceRow key={order.id} order={order} />)}{!roomOrders.length ? <EmptyState>目前沒有未完成的包廂服務。</EmptyState> : null}</div>
      </AdminPanel>
    </div>
    <AdminPanel title="現場快速入口" description="需要查看完整資料時，再進入原本的管理畫面。">
      <div className="adminRoleDashboardQuickLinks"><AdminButton onClick={() => navigate("/admin/orders")}>處理完整訂單</AdminButton><AdminButton variant="secondary" onClick={() => navigate("/admin/rooms/service")}>管理包廂服務</AdminButton><AdminButton variant="ghost" onClick={() => navigate("/admin/order-list")}>查詢歷史訂單</AdminButton></div>
    </AdminPanel>
  </div>;
}

function ManagerBusinessControls({ context, runAction, actionState }: { context: OperationsContext | null; runAction: OperationsAction; actionState: OperationsActionState }) {
  const [reason, setReason] = useState("現場營運調整");
  if (!context) return <EmptyState>尚未讀取今日營業狀態。</EmptyState>;
  const disabled = Boolean(actionState.busyId);
  const run = (id: string, request: () => Promise<unknown>, message: string) => void runAction(id, request, message);
  return <div className="adminManagerControls"><label>操作原因<input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label><div className="adminRoleDashboardQuickLinks">
    {context.periodStatus === "scheduled" ? <AdminButton disabled={disabled} onClick={() => run("business-open", () => adminApi.openBusinessPeriod({ businessDate: context.referenceBusinessDate, projectedCloseAt: context.projectedCloseAt || context.referenceEndsAt, reason }), "已執行現在開店。")}>現在開店</AdminButton> : null}
    {context.periodStatus === "open" ? <><div className="adminBusinessModeButtons" role="group" aria-label="接單模式">{["normal", "coordination", "staff_only"].map((mode) => <button type="button" className={context.intakeMode === mode ? "isActive" : ""} key={mode} disabled={disabled} onClick={() => run(`intake-${mode}`, () => adminApi.applyBusinessPeriodAction({ action: "set_intake_mode", intakeMode: mode, reason }), `已切換為${intakeModeLabel(mode)}。`)}>{intakeModeLabel(mode)}</button>)}</div><AdminButton variant="danger" disabled={disabled || context.unfinishedOrderCount > 0} onClick={() => run("business-close", () => adminApi.applyBusinessPeriodAction({ action: "close", reason }), "已執行實際關店。")}>實際關店</AdminButton></> : null}
    {context.periodStatus === "closed" ? <><AdminButton variant="secondary" disabled={disabled} onClick={() => run("business-reopen", () => adminApi.applyBusinessPeriodAction({ action: "reopen", reason }), "營業日已重開。")}>誤關重開</AdminButton><AdminButton disabled={disabled || context.unfinishedOrderCount > 0} onClick={() => run("business-settle", () => adminApi.applyBusinessPeriodAction({ action: "settle", reason }), "營業日已完成結算。")}>完成結算</AdminButton></> : null}
  </div>{context.unfinishedOrderCount > 0 ? <small className="adminRoleDashboardControlHint">仍有 {context.unfinishedOrderCount} 張未完成訂單，完成前不能關店或結算。</small> : null}</div>;
}

export function AdminManagerDashboard({ data, navigate, runAction, actionState }: Omit<DashboardProps, "user"> & { user?: CurrentAdminUser }) {
  const workingStaff = data.staff.filter((staff) => staff.isActive && staff.isWorkingToday);
  const absentStaff = data.staff.filter((staff) => staff.isActive && !staff.isWorkingToday);
  const risks = [
    ...data.orders.filter((order) => order.storeConfirmationStatus === "pending").map((order) => ({ id: `risk-${order.id}`, title: `${order.customerName || "未命名顧客"} 的協調單`, detail: "等待店家確認是否承接", action: "查看完整訂單" })),
    ...data.sessions.filter((session) => session.waitingOrderCount > 0).slice(0, 4).map((session) => ({ id: `session-${session.id}`, title: `${session.customerName || "未命名顧客"} 有待處理訂單`, detail: `${session.waitingOrderCount} 張訂單等待處理`, action: "查看點單管理" })),
    ...absentStaff.slice(0, 3).map((staff) => ({ id: `staff-${staff.id}`, title: `${staff.displayName} 尚未排班`, detail: staff.roleTitle || "請確認今日人力覆蓋", action: "查看店員資料" })),
  ];
  return <div className="adminRoleDashboard adminRoleDashboard-manager">
    <Metrics items={[
      { label: "營業狀態", value: periodStatusLabel(data.context?.periodStatus || ""), detail: intakeModeLabel(data.context?.intakeMode || "") },
      { label: "待處理／未完成", value: `${data.context?.waitingOrderCount ?? 0}／${data.context?.unfinishedOrderCount ?? 0}`, detail: "今日訂單工作量" },
      { label: "今日當班", value: workingStaff.length, detail: `共 ${data.staff.filter((staff) => staff.isActive).length} 位啟用店員` },
      { label: "包廂服務", value: data.roomOrders.filter((order) => !["completed", "cancelled"].includes(order.status)).length, detail: "尚未完成時段" },
    ]} />
    <ActionFeedback state={actionState} />
    <div className="adminRoleDashboardGrid">
      <AdminPanel title="營運控制" description="經理可在這裡處理開店、接單模式與關店；詳細操作仍保留在完整點單管理。"><ManagerBusinessControls context={data.context} runAction={runAction} actionState={actionState} /></AdminPanel>
      <AdminPanel title="當班人力" description="先確認今天是否有足夠的人力承接服務。" actions={<AdminButton variant="ghost" onClick={() => navigate("/admin/staff")}>管理店員</AdminButton>}>
        <div className="adminRoleDashboardStaffList">{workingStaff.slice(0, 8).map((staff) => <div key={staff.id}><span className="isOnline" /><strong>{staff.displayName}</strong><small>{staff.statusText || staff.roleTitle || "今日上班"}</small></div>)}{!workingStaff.length ? <EmptyState>目前沒有標記為今日上班的店員。</EmptyState> : null}</div>
      </AdminPanel>
    </div>
    <AdminPanel title="需要經理介入" description="這裡只放會影響營運節奏的事項。">
      <div className="adminRoleDashboardRows">{risks.slice(0, 8).map((risk) => <article className="adminRoleDashboardRow" key={risk.id}><div className="adminRoleDashboardIdentity"><strong>{risk.title}</strong><small>{risk.detail}</small></div><span className="adminRoleDashboardBadge">需關注</span><AdminButton variant="secondary" onClick={() => navigate(risk.id.startsWith("staff-") ? "/admin/staff" : "/admin/orders")}>{risk.action}</AdminButton></article>)}{!risks.length ? <EmptyState>目前沒有需要經理介入的事項。</EmptyState> : null}</div>
    </AdminPanel>
    <AdminPanel title="經理快速入口" description="高頻營運操作集中在這裡。"><div className="adminRoleDashboardQuickLinks"><AdminButton onClick={() => navigate("/admin/orders")}>完整點單管理</AdminButton><AdminButton variant="secondary" onClick={() => navigate("/admin/rooms/service")}>包廂服務排程</AdminButton><AdminButton variant="ghost" onClick={() => navigate("/admin/staff")}>臨時調整今日職位</AdminButton><AdminButton variant="ghost" onClick={() => navigate("/admin/settlement")}>帳目／薪資結算</AdminButton></div></AdminPanel>
  </div>;
}
