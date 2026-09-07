"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminButton, AdminPage, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";

type DashboardRole = "designated" | "service" | "manager" | "developer";
type Navigate = (route: string) => void;

type OperationsContext = {
  periodStatus?: string;
  intakeMode?: string;
  waitingOrderCount?: number;
  unfinishedOrderCount?: number;
  projectedCloseAt?: string;
  referenceStartsAt?: string;
  referenceEndsAt?: string;
};

type DashboardItem = {
  title: string;
  description: string;
  state: string;
};

type DashboardConfig = {
  label: string;
  title: string;
  description: string;
  focusTitle: string;
  focusDescription: string;
  items: DashboardItem[];
};

const dashboardConfigs: Record<DashboardRole, DashboardConfig> = {
  designated: {
    label: "指名人員",
    title: "我的指名工作台",
    description: "優先處理指名通知、自己的服務與進行中的顧客。",
    focusTitle: "我的工作重點",
    focusDescription: "後續接上當日排班後，這裡會自動顯示指名與服務事件。",
    items: [
      { title: "新的指名", description: "顧客指定由你提供服務。", state: "待即時通知" },
      { title: "進行中的服務", description: "查看目前服務與結束時間。", state: "待服務資料" },
      { title: "接單狀態", description: "休息或暫停接單時，經理會同步看到狀態。", state: "依當日狀態" },
    ],
  },
  service: {
    label: "服務員",
    title: "現場服務工作台",
    description: "集中查看顧客入場、待確認訂單、包廂與現場協助事項。",
    focusTitle: "現場工作重點",
    focusDescription: "這裡會成為服務員的主要待辦入口。",
    items: [
      { title: "待處理訂單", description: "協助確認、分派或追蹤顧客訂單。", state: "使用今日營運數據" },
      { title: "包廂服務", description: "查看即將開始、服務中與需要收尾的時段。", state: "已建立排程入口" },
      { title: "顧客協助", description: "處理點餐碼、顧客離店與現場備註。", state: "待工作事件接入" },
    ],
  },
  manager: {
    label: "經理",
    title: "營運主控台",
    description: "掌握全店待辦、人力配置、服務量與需要介入的異常。",
    focusTitle: "全店營運重點",
    focusDescription: "後續接上值班規劃後，這裡會顯示人力覆蓋與轉派建議。",
    items: [
      { title: "全店待辦", description: "查看未確認、未分派與逾時項目。", state: "使用今日營運數據" },
      { title: "當班人力", description: "確認今日各職位是否有人值班。", state: "待值班規劃接入" },
      { title: "營運控制", description: "管理接單模式、開關店與例外處理。", state: "可由完整工具進入" },
    ],
  },
  developer: {
    label: "開發者",
    title: "開發者工作台",
    description: "保留完整資料視角，同時快速切換到營業期間需要觀察的資訊。",
    focusTitle: "系統與營運重點",
    focusDescription: "完整點單管理保留作為資料、狀態與除錯工具。",
    items: [
      { title: "資料流狀態", description: "確認今日營業、接單模式與未完成數量。", state: "使用今日營運數據" },
      { title: "完整點單管理", description: "進入全部顧客、訂單與狀態操作。", state: "可直接開啟" },
      { title: "後續擴充介面", description: "預留角色 dashboard 與值班規劃資料入口。", state: "架構已保留" },
    ],
  },
};

function resolveDashboardRole(user: Record<string, unknown> | null): DashboardRole {
  const dutyRole = [user?.dutyRole, user?.operationalRole, user?.todayRole, user?.dashboardRole]
    .map((value) => String(value || "").toLowerCase())
    .find(Boolean);

  if (["designated", "nominee", "指名", "指名人員"].includes(dutyRole || "")) return "designated";
  if (["manager", "經理"].includes(dutyRole || "")) return "manager";
  if (["developer", "開發者"].includes(dutyRole || "")) return "developer";
  if (["service", "clerk", "staff", "服務員", "店員"].includes(dutyRole || "")) return "service";

  if (user?.role === "developer") return "developer";
  if (user?.role === "manager") return "manager";
  return "service";
}

function formatClock(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function periodLabel(context: OperationsContext | null) {
  if (!context) return "讀取中…";
  if (context.periodStatus === "open") return "營業中";
  if (context.periodStatus === "closed") return "已關店";
  if (context.periodStatus === "settled") return "已結算";
  return "尚未開店";
}

function intakeLabel(context: OperationsContext | null) {
  if (context?.intakeMode === "normal") return "正常接單";
  if (context?.intakeMode === "coordination") return "協調接單";
  if (context?.intakeMode === "staff_only") return "僅店員接單";
  return "—";
}

export function AdminOperationsPage({ navigate }: { navigate: Navigate }) {
  const { user } = useAdminAuth();
  const [state, setState] = useState<{ loading: boolean; context: OperationsContext | null; error: string }>({
    loading: true,
    context: null,
    error: "",
  });

  const dashboardRole = useMemo(() => resolveDashboardRole(user as Record<string, unknown> | null), [user]);
  const config = dashboardConfigs[dashboardRole];

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    adminApi.getOrderingContext()
      .then((context: OperationsContext) => setState({ loading: false, context, error: "" }))
      .catch((error: Error) => setState({ loading: false, context: null, error: error?.message || "無法讀取今日營運資料。" }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const context = state.context;
  const closeTime = context?.projectedCloseAt || context?.referenceEndsAt;

  return (
    <AdminPage
      eyebrow="LIVE OPERATIONS"
      title="營業工作台"
      description={`${user?.displayName || "目前登入者"}，這裡會依當日職位集中顯示營業期間需要關注的工作。`}
      actions={<AdminButton variant="secondary" disabled={state.loading} onClick={load}>重新整理</AdminButton>}
    >
      <section className={`adminOperationsWorkbench adminOperationsWorkbench-${dashboardRole}`}>
        <header className="adminOperationsWorkbenchHeader">
          <div>
            <span className="adminOperationsRoleTag">{config.label}視角</span>
            <h2>{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <div className="adminOperationsActions">
            <AdminButton onClick={() => navigate("/admin/rooms/service")}>包廂服務排程</AdminButton>
            <AdminButton variant="secondary" onClick={() => navigate("/admin/orders")}>完整點單管理</AdminButton>
          </div>
        </header>

        <div className="adminOperationsWorkbenchMetrics">
          <article><span>營業狀態</span><strong>{state.loading ? "讀取中…" : periodLabel(context)}</strong><small>{closeTime ? `預計 ${formatClock(closeTime)} 結束` : "今日工作狀態"}</small></article>
          <article><span>待處理訂單</span><strong>{context?.waitingOrderCount ?? "—"}</strong><small>需要被接手或確認</small></article>
          <article><span>尚未完成</span><strong>{context?.unfinishedOrderCount ?? "—"}</strong><small>仍在營業流程中的訂單</small></article>
          <article><span>接單模式</span><strong>{intakeLabel(context)}</strong><small>{config.label}工作台</small></article>
        </div>
      </section>

      {state.error ? <div className="adminOrderMessage isError" role="alert">{state.error}</div> : null}

      <div className="adminOperationsDashboardGrid">
        <AdminPanel title={config.focusTitle} description={config.focusDescription} className="adminOperationsFocusPanel">
          <div className="adminOperationsFocusList">
            {config.items.map((item) => (
              <article key={item.title}>
                <div><strong>{item.title}</strong><p>{item.description}</p></div>
                <span>{item.state}</span>
              </article>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="今日營運狀態" description="共同資料區會提供給各職位 dashboard 使用。" className="adminOperationsContextPanel">
          <dl className="adminOperationsContextList">
            <div><dt>營業時段</dt><dd>{formatClock(context?.referenceStartsAt)} ～ {formatClock(context?.referenceEndsAt)}</dd></div>
            <div><dt>目前工作視角</dt><dd>{config.label}</dd></div>
            <div><dt>快速切換</dt><dd><button type="button" onClick={() => navigate("/admin/overview")}>查看營運總覽 <span aria-hidden="true">→</span></button></dd></div>
          </dl>
        </AdminPanel>
      </div>

      <section className="adminOperationsExpansionNote" aria-label="營業工作台擴充說明">
        <span aria-hidden="true">✦</span>
        <div><strong>工作台會依當日職位自動切換</strong><p>目前先以帳號角色作為預設視角；後續接上值班規劃後，會改由當日核准的職位與時段帶入對應 dashboard。</p></div>
      </section>
    </AdminPage>
  );
}
