"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminButton, AdminPage } from "@/features/admin/shared/AdminShared.jsx";
import {
  AdminDesignatedDashboard,
  AdminManagerDashboard,
  AdminServiceDashboard,
} from "./AdminOperationsDashboards";
import { booleanValue, isRecord, numberValue, stringValue } from "./operationsFormat";
import type {
  CurrentAdminUser,
  DashboardRole,
  OperationsActionState,
  OperationsAddon,
  OperationsContext,
  OperationsData,
  OperationsNominee,
  OperationsOrder,
  OperationsRoomOrder,
  OperationsSession,
  OperationsStaffMember,
} from "./operationsTypes";

type Navigate = (route: string) => void;
type OperationalDashboardRole = Exclude<DashboardRole, "developer">;

const emptyData: OperationsData = { context: null, sessions: [], orders: [], roomOrders: [], staff: [] };

const dashboardConfigs: Record<OperationalDashboardRole, { label: string; title: string; description: string }> = {
  designated: { label: "指名人員", title: "指名人員工作台", description: "優先處理指名通知、自己的服務與進行中的顧客。" },
  service: { label: "服務員", title: "服務員工作台", description: "集中查看顧客入場、待確認訂單、包廂與現場協助事項。" },
  manager: { label: "經理", title: "經理主控台", description: "掌握全店待辦、人力配置、服務量與需要介入的異常。" },
};

const developerPreviewRoles: OperationalDashboardRole[] = ["service", "designated", "manager"];

function toAdminUser(value: unknown): CurrentAdminUser {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id),
    displayName: stringValue(record.displayName, "目前登入者"),
    role: stringValue(record.role, "clerk"),
    roleLabel: stringValue(record.roleLabel, "服務員"),
    staffMemberId: stringValue(record.staffMemberId),
  };
}

const dashboardRoleLabels: Record<OperationalDashboardRole, string> = {
  designated: "指名人員",
  service: "服務員",
  manager: "經理",
};

function resolveAccountRole(value: unknown): DashboardRole | null {
  const record = isRecord(value) ? value : {};
  if (record.role === "developer") return "developer";
  if (record.role === "manager") return "manager";
  return null;
}

function resolveAvailableDashboardRoles(value: unknown, staff: OperationsStaffMember | undefined): OperationalDashboardRole[] {
  const accountRole = resolveAccountRole(value);
  if (accountRole === "developer") return developerPreviewRoles;

  const scheduledRoles = resolveOperationalDashboardRoles(staff, "scheduledRoles");
  if (accountRole === "manager") return ["manager", ...scheduledRoles];
  if (scheduledRoles.length) return scheduledRoles;

  // Before the daily work-mode migration reaches an environment, preserve the
  // existing clerk behaviour and provide a safe service dashboard fallback.
  return ["service"];
}

function resolveOperationalDashboardRoles(
  staff: OperationsStaffMember | undefined,
  source: "scheduledRoles" | "activeRoles",
): Array<"designated" | "service"> {
  const roles = staff?.todayWorkMode?.[source];
  if (!Array.isArray(roles)) return [];
  return Array.from(new Set(roles.filter((role): role is "designated" | "service" => role === "designated" || role === "service")))
    .sort((left, right) => (left === "designated" ? -1 : right === "designated" ? 1 : 0));
}

function resolveDefaultDashboardRole(value: unknown, staff: OperationsStaffMember | undefined): OperationalDashboardRole {
  const accountRole = resolveAccountRole(value);
  if (accountRole === "manager") return "manager";
  if (accountRole === "developer") return "service";
  return resolveOperationalDashboardRoles(staff, "activeRoles")[0]
    || resolveOperationalDashboardRoles(staff, "scheduledRoles")[0]
    || "service";
}

function dashboardRoleStorageKey(user: CurrentAdminUser, staff: OperationsStaffMember | undefined) {
  const identity = user.id || user.staffMemberId || user.displayName;
  const businessDate = staff?.todayWorkMode?.businessDate || today();
  return `admin-dashboard-role:${identity}:${businessDate}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "無法讀取今日營運資料。";
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function normalizeContext(value: unknown): OperationsContext | null {
  if (!isRecord(value)) return null;
  return {
    referenceBusinessDate: stringValue(value.referenceBusinessDate, today()),
    referenceStartsAt: stringValue(value.referenceStartsAt),
    referenceEndsAt: stringValue(value.referenceEndsAt),
    periodStatus: stringValue(value.periodStatus, "scheduled"),
    intakeMode: stringValue(value.intakeMode, "staff_only"),
    orderingOpen: booleanValue(value.orderingOpen),
    projectedCloseAt: stringValue(value.projectedCloseAt),
    actualOpenedAt: stringValue(value.actualOpenedAt),
    waitingOrderCount: numberValue(value.waitingOrderCount),
    unfinishedOrderCount: numberValue(value.unfinishedOrderCount),
    openSessionCount: numberValue(value.openSessionCount),
    latestCommittedBusyUntil: stringValue(value.latestCommittedBusyUntil),
  };
}

function normalizeSession(value: unknown): OperationsSession | null {
  if (!isRecord(value)) return null;
  const session = isRecord(value.session) ? value.session : value;
  const id = stringValue(session.id);
  if (!id) return null;
  return {
    id,
    customerName: stringValue(session.customerName, "未命名顧客"),
    gameId: stringValue(session.gameId, "—"),
    status: stringValue(session.status),
    orderCount: numberValue(value.orderCount),
    waitingOrderCount: numberValue(value.waitingOrderCount),
    confirmedOrderCount: numberValue(value.confirmedOrderCount),
    totalAmount: numberValue(value.totalAmount),
    lastOrderedAt: stringValue(value.lastOrderedAt),
  };
}

function normalizeNominee(value: unknown): OperationsNominee | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  return {
    id,
    staffId: stringValue(value.staffId),
    staffName: stringValue(value.staffName, "未指定店員"),
    serviceName: stringValue(value.serviceName, "指名服務"),
    segmentCount: numberValue(value.segmentCount, 1),
    requestedStartsAt: stringValue(value.requestedStartsAt),
    requestedServiceEndsAt: stringValue(value.requestedServiceEndsAt),
    busyUntil: stringValue(value.busyUntil),
    confirmationStatus: stringValue(value.confirmationStatus),
  };
}

function normalizeAddon(value: unknown): OperationsAddon | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  return { id, staffId: stringValue(value.staffId), staffName: stringValue(value.staffName, "未指定店員"), serviceName: stringValue(value.serviceName, "附掛加購服務"), status: stringValue(value.status) };
}

function normalizeOrder(value: unknown, session: OperationsSession): OperationsOrder | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  const nominees = Array.isArray(value.nominees) ? value.nominees.map(normalizeNominee).filter((item): item is OperationsNominee => Boolean(item)) : [];
  const addons = Array.isArray(value.addons) ? value.addons.map(normalizeAddon).filter((item): item is OperationsAddon => Boolean(item)) : [];
  const roomBookings = Array.isArray(value.roomBookings) ? value.roomBookings.filter(isRecord).map((item) => ({ roomName: stringValue(item.roomName, "包廂"), startsAt: stringValue(item.startsAt), endsAt: stringValue(item.endsAt), status: stringValue(item.status) })) : [];
  return {
    id,
    sessionId: session.id,
    customerName: session.customerName,
    gameId: session.gameId,
    orderNumber: stringValue(value.orderNumber, id),
    orderKind: stringValue(value.orderKind),
    status: stringValue(value.status),
    storeConfirmationStatus: stringValue(value.storeConfirmationStatus),
    queueStage: stringValue(value.queueStage),
    queueMinutes: numberValue(value.queueMinutes),
    submittedAt: stringValue(value.submittedAt),
    totalAmount: numberValue(value.totalAmount),
    customerNote: stringValue(value.customerNote),
    nominees,
    addons,
    roomBookings,
  };
}

function normalizeRoomOrder(value: unknown): OperationsRoomOrder | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  return { id, roomName: stringValue(value.roomName, "包廂"), startsAt: stringValue(value.startsAt), endsAt: stringValue(value.endsAt), segmentCount: numberValue(value.segmentCount, 1), totalAmount: numberValue(value.totalAmount), status: stringValue(value.status), note: stringValue(value.note) };
}

function normalizeStaffMember(value: unknown): OperationsStaffMember | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  const workMode = isRecord(value.todayWorkMode) ? {
    businessDate: stringValue(value.todayWorkMode.businessDate),
    isWorking: booleanValue(value.todayWorkMode.isWorking, booleanValue(value.isWorkingToday, true)),
    scheduledRoles: Array.isArray(value.todayWorkMode.scheduledRoles) ? value.todayWorkMode.scheduledRoles.map((role) => stringValue(role)).filter(Boolean) : [],
    activeRoles: Array.isArray(value.todayWorkMode.activeRoles) ? value.todayWorkMode.activeRoles.map((role) => stringValue(role)).filter(Boolean) : [],
  } : null;
  return { id, displayName: stringValue(value.displayName, "未命名店員"), roleTitle: stringValue(value.roleTitle), statusText: stringValue(value.statusText), isWorkingToday: booleanValue(value.isWorkingToday, true), isActive: booleanValue(value.isActive, true), todayWorkMode: workMode };
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function AdminRoleOperationsPage({ navigate }: { navigate: Navigate }) {
  const { user } = useAdminAuth();
  const adminUser = useMemo(() => toAdminUser(user), [user]);
  const [state, setState] = useState({ loading: true, data: emptyData, error: "" });
  const [actionState, setActionState] = useState<OperationsActionState>({ busyId: "", message: "", error: "" });
  const currentStaff = useMemo(() => state.data.staff.find((staff) => staff.id === adminUser.staffMemberId), [adminUser.staffMemberId, state.data.staff]);
  const availableRoles = useMemo(() => resolveAvailableDashboardRoles(user, currentStaff), [currentStaff, user]);
  const defaultRole = useMemo(() => resolveDefaultDashboardRole(user, currentStaff), [currentStaff, user]);
  const roleStorageKey = useMemo(() => dashboardRoleStorageKey(adminUser, currentStaff), [adminUser, currentStaff]);
  const availableRoleSignature = availableRoles.join("|");
  const [selectedRole, setSelectedRole] = useState<OperationalDashboardRole | null>(null);
  useEffect(() => {
    let persistedRole: OperationalDashboardRole | null = null;
    try {
      const storedRole = window.sessionStorage.getItem(roleStorageKey);
      if (storedRole === "designated" || storedRole === "service" || storedRole === "manager") persistedRole = storedRole;
    } catch {
      persistedRole = null;
    }
    setSelectedRole(persistedRole && availableRoles.includes(persistedRole) ? persistedRole : defaultRole);
  }, [availableRoleSignature, availableRoles, defaultRole, roleStorageKey]);
  const selectDashboardRole = useCallback((role: OperationalDashboardRole) => {
    if (!availableRoles.includes(role)) return;
    setSelectedRole(role);
    try {
      window.sessionStorage.setItem(roleStorageKey, role);
    } catch {
      // Session storage is optional; role switching remains available in memory.
    }
  }, [availableRoles, roleStorageKey]);
  const dashboardRole = selectedRole && availableRoles.includes(selectedRole) ? selectedRole : defaultRole;
  const config = dashboardConfigs[dashboardRole];
  const isDeveloperPreview = adminUser.role === "developer";

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const context = normalizeContext(await adminApi.getOrderingContext());
      const businessDate = context?.referenceBusinessDate || today();
      const [sessionResult, roomResult, staffResult] = await Promise.allSettled([
        adminApi.getOrderSessions({ businessDate }),
        adminApi.getRoomOrders({ businessDate }),
        adminApi.getStaffMembers(),
      ]);
      const sessions = arrayValue(sessionResult.status === "fulfilled" ? sessionResult.value : undefined).map(normalizeSession).filter((item): item is OperationsSession => Boolean(item));
      const ordersBySession = await Promise.all(sessions.map(async (session) => {
        try {
          const value = await adminApi.getSessionOrders(session.id);
          return arrayValue(value).map((item) => normalizeOrder(item, session)).filter((item): item is OperationsOrder => Boolean(item));
        } catch {
          return [];
        }
      }));
      const data: OperationsData = {
        context,
        sessions,
        orders: ordersBySession.flat(),
        roomOrders: arrayValue(roomResult.status === "fulfilled" ? roomResult.value : undefined).map(normalizeRoomOrder).filter((item): item is OperationsRoomOrder => Boolean(item)),
        staff: arrayValue(staffResult.status === "fulfilled" ? staffResult.value : undefined).map(normalizeStaffMember).filter((item): item is OperationsStaffMember => Boolean(item)),
      };
      setState({ loading: false, data, error: context ? "" : "今日營運資料格式異常，請前往完整點單管理確認。" });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const runAction = useCallback(async (id: string, request: () => Promise<unknown>, successMessage: string) => {
    setActionState({ busyId: id, message: "", error: "" });
    try {
      await request();
      setActionState({ busyId: "", message: successMessage, error: "" });
      await load();
    } catch (error) {
      setActionState({ busyId: "", message: "", error: errorMessage(error) });
    }
  }, [load]);

  return <AdminPage eyebrow={`${isDeveloperPreview ? "DEVELOPER PREVIEW · " : ""}${config.label.toUpperCase()} DASHBOARD`} title={config.title} description={`${adminUser.displayName}，${isDeveloperPreview ? "可切換檢視三種營業工作台；" : ""}${config.description}`} actions={<><AdminButton variant="secondary" disabled={state.loading} onClick={() => void load()}>{state.loading ? "讀取中…" : "重新整理"}</AdminButton>{isDeveloperPreview ? <AdminButton variant="ghost" onClick={() => navigate("/admin/orders")}>完整點單管理</AdminButton> : null}</>}>
    {state.error ? <div className="adminOrderMessage isError" role="alert">{state.error}</div> : null}
    {availableRoles.length > 1 ? <div className={`adminRoleSwitcher${isDeveloperPreview ? " isDeveloperPreview" : ""}`} role="group" aria-label={isDeveloperPreview ? "開發者工作台預覽切換" : "今日可用工作身分"}><span>{isDeveloperPreview ? "開發者預覽" : adminUser.role === "manager" ? "目前工作視角" : "今日可用身分"}</span>{availableRoles.map((role) => <button type="button" className={dashboardRole === role ? "isActive" : ""} aria-pressed={dashboardRole === role} key={role} onClick={() => selectDashboardRole(role)}>{dashboardRoleLabels[role]}</button>)}</div> : null}
    {!isDeveloperPreview && currentStaff?.todayWorkMode && currentStaff.todayWorkMode.isWorking && !currentStaff.todayWorkMode.activeRoles.some((role) => role === "service" || role === "designated") ? <div className="adminRoleDashboardNotice" role="status">今天尚未啟用服務員或指名人員身分，目前依今日排班顯示預設工作台；若需調整，請先確認值班規劃，再到店員設定開啟今日啟用職位。</div> : null}
    {dashboardRole === "designated" ? <AdminDesignatedDashboard data={state.data} user={adminUser} navigate={navigate} runAction={runAction} actionState={actionState} /> : null}
    {dashboardRole === "service" ? <AdminServiceDashboard data={state.data} navigate={navigate} runAction={runAction} actionState={actionState} /> : null}
    {dashboardRole === "manager" ? <AdminManagerDashboard data={state.data} navigate={navigate} runAction={runAction} actionState={actionState} /> : null}
  </AdminPage>;
}
