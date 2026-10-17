"use client";

import { AdminRefreshButton } from "@/features/admin/shared/AdminRefreshButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requireBusinessDate } from "@/features/admin/shared/businessDay";
import { adminApi, adminRequest, ApiError } from "@/features/admin/api/client.js";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext";
import { AdminButton, AdminPage, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import {
  AdminManagerDashboard,
  AdminServiceDashboard,
} from "./AdminOperationsDashboards";
import { AdminDesignatedWorkbench } from "./AdminDesignatedWorkbench";
import { StaffWorkStatusPanel } from "./StaffWorkStatusPanel";
import { useWorkbenchPreference } from "./useWorkbenchPreference";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { normalizeContext, normalizeStaffMember } from "./operationsData";
import { AdminCreateOrderPassDrawer } from "./AdminCreateOrderPassDrawer.jsx";
import { AdminCreateRoomServiceDrawer } from "./AdminCreateRoomServiceDrawer.jsx";
import { isRecord, numberValue, stringValue } from "./operationsFormat";
import type {
  CurrentAdminUser,
  DashboardRole,
  OperationsActionState,
  OperationsAddon,
  OperationsData,
  OperationsNominee,
  OperationsOrder,
  OperationsRoomOrder,
  OperationsSession,
  OperationsStaffMember,
} from "./operationsTypes";

type Navigate = (route: string) => void;
type OperationalDashboardRole = Exclude<DashboardRole, "developer">;

const emptyData: OperationsData = { context: null, sessions: [], orders: [], roomOrders: [], staff: [], dutyPlans: null, dutyPlansError: "", refreshedAt: 0 };


const dashboardConfigs: Record<OperationalDashboardRole, { label: string; title: string; description: string }> = {
  designated: { label: "指名人員", title: "指名人員工作台", description: "優先處理指名通知、自己的服務與進行中的顧客。" },
  service: { label: "服務員", title: "服務員工作台", description: "顧客入場、確認訂單、包廂與現場協助。" },
  manager: { label: "經理", title: "經理工作台", description: "掌握全店待辦、人力配置、服務量與需要介入的異常。" },
};

const todayBusinessDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "無法讀取今日營運資料。";
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
    businessPeriodId: stringValue(session.businessPeriodId),
    entryStatus: stringValue(session.entryStatus, "open"),
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
    reservedMinutes: numberValue(value.reservedMinutes),
    bufferMinutes: numberValue(value.bufferMinutes),
    segmentMinutes: numberValue(value.segmentMinutes, 20),
    minimumSegments: numberValue(value.minimumSegmentCount, 1),
  };
}

function normalizeAddon(value: unknown): OperationsAddon | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  return { id, staffId: stringValue(value.staffId), staffName: stringValue(value.staffName, "未指定店員"), serviceName: stringValue(value.serviceName, "附掛加購服務"), status: stringValue(value.status), parentNomineeId: stringValue(value.parentNomineeId) };
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
    businessPeriodId: stringValue(value.businessPeriodId),
    status: stringValue(value.status),
    storeConfirmationStatus: stringValue(value.storeConfirmationStatus),
    queueStage: stringValue(value.queueStage),
    queueMinutes: numberValue(value.queueMinutes),
    submittedAt: stringValue(value.submittedAt),
    totalAmount: numberValue(value.totalAmount),
    customerNote: stringValue(value.customerNote),
    customerLocation: stringValue(value.customerLocation),
    flowVersion: numberValue(value.flowVersion, 1),
    startedAt: stringValue(value.startedAt),
    completedAt: stringValue(value.completedAt),
    requestSource: Array.isArray(value.history) && value.history.filter(isRecord).some((item) => item.actorType === "manager_transfer") ? "manager_transfer" : "customer",
    items: Array.isArray(value.items) ? value.items.filter(isRecord).map((item) => ({ name: stringValue(item.name), quantity: numberValue(item.quantity), kind: stringValue(item.itemType) })) : [],
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


function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function AdminRoleOperationsPage({ navigate }: { navigate: Navigate }) {
  const { user } = useAdminAuth();
  const adminUser = useMemo(() => toAdminUser(user), [user]);
  const [state, setState] = useState({ loading: true, data: emptyData, error: "", authorizationError: "" });
  const loadGeneration = useRef(0);
  const loadRequest = useRef<AbortController | null>(null);
  const loadedAccount = useRef("");
  const [actionState, setActionState] = useState<OperationsActionState>({ busyId: "", message: "", error: "" });
  const [createPassOpen, setCreatePassOpen] = useState(false);
  const [issuedPass, setIssuedPass] = useState<unknown>(null);
  const [createRoomServiceOpen, setCreateRoomServiceOpen] = useState(false);
  const currentStaff = useMemo(() => state.data.staff.find((staff) => staff.id === adminUser.staffMemberId), [adminUser.staffMemberId, state.data.staff]);
  const { availableRoles, dashboardRole, selectDashboardRole, preferenceSaving, preferenceError, preferenceSaved } = useWorkbenchPreference();
  const config = dashboardConfigs[dashboardRole];
  const isDeveloperPreview = adminUser.role === "developer";
  const canManage = adminUser.role === "developer" || adminUser.role === "manager";

  const load = useCallback(async (background = false) => {
    if (loadedAccount.current !== adminUser.id) {
      loadedAccount.current = adminUser.id;
      setState({ loading: true, data: emptyData, error: "", authorizationError: "" });
    }
    const generation = ++loadGeneration.current;
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    if (!background) setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const context = normalizeContext(await adminApi.getOrderingContext(controller.signal));
      const businessDate = requireBusinessDate(context);
      if (generation === loadGeneration.current) setState((current) => ({ ...current, authorizationError: "" }));
      const [sessionResult, roomResult, staffResult] = await Promise.allSettled([
        dashboardRole === "designated"
          ? adminRequest(`/designated-order-sessions?businessDate=${encodeURIComponent(businessDate)}`, { signal: controller.signal })
          : adminApi.getOrderSessions({ businessDate }, controller.signal),
        adminApi.getRoomOrders({ businessDate }, controller.signal),
        adminApi.getStaffMembers(controller.signal),
      ]);
      for (const result of [sessionResult, roomResult, staffResult]) {
        if (result.status === "rejected" && result.reason instanceof ApiError && [401, 403].includes(result.reason.status)) throw result.reason;
      }
      if (sessionResult.status === "rejected") {
        if (dashboardRole === "designated" && adminUser.staffMemberId && sessionResult.reason instanceof ApiError && sessionResult.reason.status === 404) {
          throw new Error("指名工作台資料服務尚未就緒（HTTP 404），請確認系統更新已完成。");
        }
        throw sessionResult.reason;
      }
      if (staffResult.status === "rejected") throw staffResult.reason;
      if (!Array.isArray(sessionResult.value) || !Array.isArray(staffResult.value)) throw new Error("營業資料格式異常，請重新整理。");
      const sessions = arrayValue(sessionResult.status === "fulfilled" ? sessionResult.value : undefined).map(normalizeSession).filter((item): item is OperationsSession => Boolean(item));
      const staff = staffResult.value.map(normalizeStaffMember).filter((item): item is OperationsStaffMember => Boolean(item));
      const ordersBySession = await Promise.all(sessions.map(async (session) => {
        const value = await adminApi.getSessionOrders(session.id, controller.signal);
        if (!Array.isArray(value)) throw new Error("顧客訂單資料格式異常，請重新整理。");
        return value.map((item) => normalizeOrder(item, session)).filter((item): item is OperationsOrder => Boolean(item));
      }));
      const data: OperationsData = {
        context,
        sessions,
        orders: ordersBySession.flat(),
        roomOrders: arrayValue(roomResult.status === "fulfilled" ? roomResult.value : undefined).map(normalizeRoomOrder).filter((item): item is OperationsRoomOrder => Boolean(item)),
        staff,
        dutyPlans: null,
        dutyPlansError: "",
        refreshedAt: Date.now(),
      };
      if (generation === loadGeneration.current) setState({ loading: false, data, error: roomResult.status === "rejected" ? "包廂資料暫時無法更新，請重新整理。" : "", authorizationError: "" });
    } catch (error) {
      if (generation === loadGeneration.current) setState((current) => ({ ...current, loading: false, error: errorMessage(error),
        authorizationError: error instanceof ApiError && [401, 403].includes(error.status) ? "登入或管理權限無法確認，請重新登入後再操作。" : current.authorizationError }));
    }
  }, [adminUser.id, adminUser.staffMemberId, dashboardRole]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(timer); loadGeneration.current += 1; loadRequest.current?.abort(); };
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 30_000);
    return () => window.clearInterval(timer);
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

  const openCreatePass = useCallback(() => {
    setIssuedPass(null);
    setCreatePassOpen(true);
  }, []);
  const closeCreatePass = useCallback(() => {
    setCreatePassOpen(false);
    setIssuedPass(null);
  }, []);
  const handleCreatePassIssued = useCallback(async (result: unknown) => {
    setCreatePassOpen(false);
    setIssuedPass(result);
    await load();
  }, [load]);
  const openCreateRoomService = useCallback(() => setCreateRoomServiceOpen(true), []);
  const closeCreateRoomService = useCallback(() => setCreateRoomServiceOpen(false), []);
  const handleRoomServiceCreated = useCallback(async (result: unknown) => {
    const roomName = isRecord(result) ? stringValue(result.roomName) : "";
    setCreateRoomServiceOpen(false);
    setActionState({ busyId: "", message: `${roomName || "包廂服務"}已建立。`, error: "" });
    await load();
  }, [load]);

  return <AdminPage eyebrow={`${isDeveloperPreview ? "DEVELOPER PREVIEW · " : ""}${config.label.toUpperCase()} DASHBOARD`} title={config.title} description={`${adminUser.displayName}，${isDeveloperPreview ? "可切換檢視三種營業工作台；" : ""}${config.description}`} actions={<><AdminRefreshButton loading={state.loading} disabled={state.loading} onClick={() => void load()} />{dashboardRole === "service" ? <><AdminButton onClick={openCreatePass}>發點餐碼</AdminButton><AdminButton onClick={openCreateRoomService}>訂購包廂</AdminButton></> : dashboardRole === "manager" ? <AdminButton variant="ghost" onClick={() => navigate("/admin/orders")}>完整點單管理</AdminButton> : null}</>}>
    {state.error ? <div className="adminOrderMessage isError" role="alert">{state.error}</div> : null}
    {availableRoles.length > 1 ? <div className={`adminRoleSwitcher${isDeveloperPreview ? " isDeveloperPreview" : ""}`} role="group" aria-label={isDeveloperPreview ? "開發者工作台預覽切換" : "工作台視角切換"}>
      <span>{isDeveloperPreview ? "開發者預覽" : "目前工作視角"}</span>
      <AdminHelp title="工作台偏好說明">切換工作台會保存為帳號偏好，跨營業日、重新登入及換裝置沿用；不會變更計薪職位、支援工作或接單狀態。由網址指定工作台只影響本次顯示。</AdminHelp>
      {availableRoles.map((role) => <button type="button" className={dashboardRole === role ? "isActive" : ""} aria-pressed={dashboardRole === role} key={role} onClick={() => selectDashboardRole(role)}>{dashboardRoleLabels[role]}</button>)}
      {(preferenceSaving || preferenceSaved) && <span role="status">{preferenceSaving ? "保存偏好中…" : "偏好已保存"}</span>}
    </div> : null}
    {preferenceError && <div className="adminFormError" role="alert">偏好尚未保存：{preferenceError} <AdminButton variant="ghost" onClick={() => selectDashboardRole(dashboardRole)}>重試保存偏好</AdminButton></div>}
    {!isDeveloperPreview && currentStaff?.todayWorkMode?.isWorking && !currentStaff.todayWorkMode.activeRoles.length ? <div className="adminRoleDashboardNotice" role="status">目前尚未啟用支援工作，可在「目前支援工作」調整廣播受眾。</div> : null}
    {dashboardRole !== "manager" && currentStaff && !isDeveloperPreview ? <AdminPanel title="我的當班狀態" description="接單與支援工作開關即時儲存；計薪職位由值班規劃核准。">
      <StaffWorkStatusPanel key={`${currentStaff.id}:${currentStaff.todayWorkMode?.businessDate || "pending"}`} staff={currentStaff} disabled={state.loading || Boolean(state.error) || Boolean(actionState.busyId)} onChanged={() => load(true)} />
    </AdminPanel> : null}
    {dashboardRole === "designated" ? <AdminDesignatedWorkbench data={state.data} user={adminUser} onChanged={() => load(true)} loading={state.loading} loadError={state.error} /> : null}
    {dashboardRole === "service" ? <AdminServiceDashboard data={state.data} user={adminUser} navigate={navigate} runAction={runAction} actionState={actionState} onChanged={() => load(true)} disabled={state.loading || Boolean(state.error)} /> : null}
    {dashboardRole === "manager" ? <AdminManagerDashboard disabled={state.loading || Boolean(state.error)} staffingBlockedReason={state.authorizationError} onChanged={() => load(true)} data={state.data} user={adminUser} navigate={navigate} runAction={runAction} actionState={actionState} onOpenCreatePass={openCreatePass} onOpenCreateRoomService={openCreateRoomService} /> : null}
    {(createPassOpen || issuedPass) ? <AdminCreateOrderPassDrawer canManage={canManage} issued={issuedPass} onClose={closeCreatePass} onIssued={handleCreatePassIssued} /> : null}
    {createRoomServiceOpen ? <AdminCreateRoomServiceDrawer businessDate={state.data.context?.referenceBusinessDate || todayBusinessDate()} onClose={closeCreateRoomService} onCreated={handleRoomServiceCreated} /> : null}
  </AdminPage>;
}
