"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminButton, AdminField, AdminPage, AdminPanel, AdminToggle } from "@/features/admin/shared/AdminShared.jsx";

type DutyRole = "service" | "designated" | "backstage";
type ApprovalStatus = "pending" | "approved" | "rejected";

type DutyPlan = {
  id: string;
  staffId: string;
  staffName: string;
  businessDate: string;
  isWorking: boolean;
  startTime?: string | null;
  endTime?: string | null;
  scheduledRoles: DutyRole[];
  approvalStatus: ApprovalStatus;
  submittedAt?: string;
  approvalNote?: string | null;
};

type StaffOption = {
  id: string;
  displayName: string;
  roleTitle?: string | null;
};

type DutyPlanDraft = {
  id?: string;
  staffId: string;
  businessDate: string;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  scheduledRoles: DutyRole[];
};

type Navigate = (route: string) => void;

const dutyRoleOptions: Array<{ id: DutyRole; label: string; description: string }> = [
  { id: "service", label: "服務員", description: "接待、點餐碼與現場協助" },
  { id: "designated", label: "指名人員", description: "承接被指名的服務" },
  { id: "backstage", label: "幕後", description: "備料、後台與營運支援" },
];

const approvalLabels: Record<ApprovalStatus, string> = {
  pending: "待核准",
  approved: "已核准",
  rejected: "已退回",
};

function today() {
  return new Date().toLocaleDateString("sv-SE");
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("sv-SE");
}

function displayDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", weekday: "short" });
}

function normalizePlan(value: Record<string, unknown>): DutyPlan | null {
  if (!value.id || !value.staffId || !value.businessDate) return null;
  const roles = Array.isArray(value.scheduledRoles)
    ? value.scheduledRoles.filter((role): role is DutyRole => role === "service" || role === "designated" || role === "backstage")
    : [];
  const status = value.approvalStatus === "approved" || value.approvalStatus === "rejected" ? value.approvalStatus : "pending";
  return {
    id: String(value.id),
    staffId: String(value.staffId),
    staffName: String(value.staffName || "未命名店員"),
    businessDate: String(value.businessDate),
    isWorking: value.isWorking !== false,
    startTime: value.startTime ? String(value.startTime) : null,
    endTime: value.endTime ? String(value.endTime) : null,
    scheduledRoles: roles,
    approvalStatus: status,
    submittedAt: value.submittedAt ? String(value.submittedAt) : undefined,
    approvalNote: value.approvalNote ? String(value.approvalNote) : null,
  };
}

function roleLabel(role: DutyRole) {
  return dutyRoleOptions.find((option) => option.id === role)?.label || role;
}

function emptyDraft(staffId: string, businessDate: string): DutyPlanDraft {
  return { staffId, businessDate, isWorking: true, startTime: "20:00", endTime: "24:00", scheduledRoles: ["service"] };
}

export function AdminDutyPlanningPage({ navigate }: { navigate: Navigate }) {
  const { user } = useAdminAuth();
  const canManageAll = user.role === "manager" || user.role === "developer";
  const [rangeStart, setRangeStart] = useState(today);
  const rangeEnd = useMemo(() => addDays(rangeStart, 13), [rangeStart]);
  const [plans, setPlans] = useState<DutyPlan[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [draft, setDraft] = useState<DutyPlanDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [planResult, staffResult] = await Promise.all([
        adminApi.getDutyPlans({ from: rangeStart, to: rangeEnd }),
        adminApi.getStaffMembers(),
      ]);
      const nextPlans = (Array.isArray(planResult) ? planResult : [])
        .map((value: Record<string, unknown>) => normalizePlan(value))
        .filter((value: DutyPlan | null): value is DutyPlan => Boolean(value));
      const nextStaff = (Array.isArray(staffResult) ? staffResult : [])
        .map((value: Record<string, unknown>) => ({ id: String(value.id), displayName: String(value.displayName || "未命名店員"), roleTitle: value.roleTitle ? String(value.roleTitle) : null }));
      setPlans(nextPlans);
      setStaff(nextStaff);
      setDraft((current) => current && nextStaff.some((item) => item.id === current.staffId) ? current : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "值班規劃載入失敗。請稍後再試。");
    } finally {
      setLoading(false);
    }
  }, [rangeEnd, rangeStart]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const ownStaff = staff.find((item) => item.id === user.staffMemberId);
  const editableStaff = canManageAll ? staff : (ownStaff ? [ownStaff] : []);
  const pendingCount = plans.filter((plan) => plan.approvalStatus === "pending").length;
  const approvedCount = plans.filter((plan) => plan.approvalStatus === "approved").length;
  const rejectedCount = plans.filter((plan) => plan.approvalStatus === "rejected").length;
  const groupedPlans = useMemo(() => {
    const grouped = new Map<string, DutyPlan[]>();
    plans.forEach((plan) => grouped.set(plan.businessDate, [...(grouped.get(plan.businessDate) || []), plan]));
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [plans]);

  const startNew = (businessDate = rangeStart) => {
    const staffId = canManageAll ? (staff[0]?.id || "") : (user.staffMemberId || "");
    setDraft(emptyDraft(staffId, businessDate));
    setMessage("");
    setError("");
  };

  const editPlan = (plan: DutyPlan) => {
    setDraft({
      id: plan.id,
      staffId: plan.staffId,
      businessDate: plan.businessDate,
      isWorking: plan.isWorking,
      startTime: plan.startTime || "20:00",
      endTime: plan.endTime || "24:00",
      scheduledRoles: plan.scheduledRoles.length ? plan.scheduledRoles : ["service"],
    });
    setMessage("");
    setError("");
  };

  const toggleRole = (role: DutyRole) => {
    setDraft((current) => {
      if (!current) return current;
      const roles = current.scheduledRoles.includes(role)
        ? current.scheduledRoles.filter((value) => value !== role)
        : [...current.scheduledRoles, role];
      return { ...current, scheduledRoles: roles };
    });
  };

  const save = async () => {
    if (!draft || saving) return;
    if (!draft.staffId) { setError("請先選擇店員。"); return; }
    if (draft.isWorking && draft.scheduledRoles.length === 0) { setError("值班日請至少選擇一個職位。"); return; }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const body = {
        staffId: draft.staffId,
        businessDate: draft.businessDate,
        isWorking: draft.isWorking,
        startTime: draft.isWorking ? draft.startTime : null,
        endTime: draft.isWorking ? draft.endTime : null,
        scheduledRoles: draft.isWorking ? draft.scheduledRoles : [],
      };
      const saved = draft.id ? await adminApi.updateDutyPlan(draft.id, body) : await adminApi.createDutyPlan(body);
      const normalized = normalizePlan(saved as Record<string, unknown>);
      if (normalized) setPlans((current) => [...current.filter((item) => item.id !== normalized.id && !(item.staffId === normalized.staffId && item.businessDate === normalized.businessDate)), normalized].sort((left, right) => `${left.businessDate}-${left.staffName}`.localeCompare(`${right.businessDate}-${right.staffName}`)));
      setDraft(null);
      setMessage(canManageAll ? "值班規劃已儲存並核准。" : "值班規劃已送出，等待經理核准。" );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "值班規劃儲存失敗。" );
    } finally {
      setSaving(false);
    }
  };

  const review = async (plan: DutyPlan, action: "approve" | "reject") => {
    if (reviewingId) return;
    const note = action === "reject" ? window.prompt("請輸入退回原因：", plan.approvalNote || "") : null;
    if (action === "reject" && !note?.trim()) return;
    setReviewingId(plan.id);
    setError("");
    setMessage("");
    try {
      const saved = await adminApi.reviewDutyPlan(plan.id, { action, note: note?.trim() || null });
      const normalized = normalizePlan(saved as Record<string, unknown>);
      if (normalized) setPlans((current) => current.map((item) => item.id === normalized.id ? normalized : item));
      setMessage(action === "approve" ? `${plan.staffName} 的值班規劃已核准。` : `${plan.staffName} 的值班規劃已退回。`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "值班規劃審核失敗。" );
    } finally {
      setReviewingId("");
    }
  };

  return <AdminPage eyebrow="DUTY PLANNING" title="值班規劃" description="先填寫未來可上班日期、時段與職位，再由經理核准；已核准的今日規劃會帶入營業工作台。" actions={<><AdminButton variant="secondary" disabled={loading} onClick={() => void load()}>重新整理</AdminButton><AdminButton onClick={() => startNew()}>＋ 新增值班規劃</AdminButton></>}>
    {error ? <div className="adminOrderMessage isError" role="alert">{error}</div> : null}
    {message ? <div className="adminOrderMessage" role="status">{message}</div> : null}

    <section className="adminDutyPlanningMetrics" aria-label="值班規劃摘要">
      <article><span>顯示期間</span><strong>{displayDate(rangeStart)} ～ {displayDate(rangeEnd)}</strong><small>共 14 天</small></article>
      <article><span>待核准</span><strong>{pendingCount}</strong><small>需要經理確認</small></article>
      <article><span>已核准</span><strong>{approvedCount}</strong><small>會帶入營運判斷</small></article>
      <article><span>已退回</span><strong>{rejectedCount}</strong><small>可修改後重新送出</small></article>
    </section>

    <div className="adminDutyPlanningToolbar">
      <AdminField label="從哪一天開始顯示"><input type="date" min={today()} value={rangeStart} onChange={(event) => setRangeStart(event.target.value || today())} /></AdminField>
      <div className="adminDutyPlanningToolbarNote"><strong>{canManageAll ? "經理／開發者視角" : "個人值班規劃"}</strong><small>{canManageAll ? "可查看、編輯與核准所有店員的規劃。" : "可預先填寫自己的日期與時段，送出後由經理核准。"}</small></div>
    </div>

    <div className="adminDutyPlanningLayout">
      <div className="adminDutyPlanningList">
        {loading ? <div className="adminInlineState">載入值班規劃中…</div> : null}
        {!loading && groupedPlans.length === 0 ? <AdminPanel title="目前尚無值班規劃" description="先新增一筆未來日期的規劃，讓經理可以安排與核准。"><AdminButton onClick={() => startNew()}>建立第一筆規劃</AdminButton></AdminPanel> : null}
        {groupedPlans.map(([date, datePlans]) => <AdminPanel key={date} className="adminDutyDatePanel" title={displayDate(date)} description={`${datePlans.length} 位店員已填寫規劃`}>
          <div className="adminDutyPlanList">
            {datePlans.map((plan) => <article className={`adminDutyPlanCard is-${plan.approvalStatus}`} key={plan.id}>
              <div className="adminDutyPlanIdentity"><strong>{plan.staffName}</strong><small>{plan.isWorking ? `${plan.startTime} ～ ${plan.endTime}` : "休假／不值班"}</small></div>
              <div className="adminDutyPlanRoles">{plan.scheduledRoles.length ? plan.scheduledRoles.map((role) => <span key={role}>{roleLabel(role)}</span>) : <span>無啟用職位</span>}</div>
              <div className="adminDutyPlanStatus"><b>{approvalLabels[plan.approvalStatus]}</b>{plan.approvalNote ? <small>{plan.approvalNote}</small> : null}</div>
              <div className="adminDutyPlanActions"><AdminButton variant="ghost" onClick={() => editPlan(plan)} disabled={!canManageAll && plan.staffId !== user.staffMemberId}>編輯</AdminButton>{canManageAll && plan.approvalStatus !== "approved" ? <><AdminButton variant="secondary" disabled={reviewingId === plan.id} onClick={() => void review(plan, "approve")}>核准</AdminButton><AdminButton variant="danger" disabled={reviewingId === plan.id} onClick={() => void review(plan, "reject")}>退回</AdminButton></> : null}</div>
            </article>)}
          </div>
        </AdminPanel>)}
      </div>

      <AdminPanel className="adminDutyPlanEditor" title={draft ? (draft.id ? "編輯值班規劃" : "新增值班規劃") : "先選擇一筆規劃"} description={draft ? (canManageAll ? "經理／開發者儲存後會直接視為已核准。" : "送出後會進入待核准狀態，核准前不會影響今日 dashboard。") : "從左側編輯既有規劃，或新增一筆日期與時段。"}>
        {draft ? <div className="adminDutyPlanForm">
          {canManageAll ? <AdminField label="店員"><select value={draft.staffId} onChange={(event) => setDraft((current) => current ? { ...current, staffId: event.target.value } : current)}><option value="">請選擇店員</option>{editableStaff.map((item) => <option key={item.id} value={item.id}>{item.displayName}{item.roleTitle ? `｜${item.roleTitle}` : ""}</option>)}</select></AdminField> : <div className="adminDutyPlanReadonly"><span>店員</span><strong>{ownStaff?.displayName || "目前帳號尚未綁定店員"}</strong></div>}
          <AdminField label="值班日期"><input type="date" min={today()} value={draft.businessDate} onChange={(event) => setDraft((current) => current ? { ...current, businessDate: event.target.value } : current)} /></AdminField>
          <AdminField label="當天狀態"><select value={draft.isWorking ? "working" : "off"} onChange={(event) => setDraft((current) => current ? { ...current, isWorking: event.target.value === "working" } : current)}><option value="working">有上班</option><option value="off">休假／不值班</option></select></AdminField>
          {draft.isWorking ? <div className="adminDutyPlanTimeGrid"><AdminField label="開始時間"><input type="text" inputMode="numeric" maxLength={5} placeholder="例如 20:00" value={draft.startTime} onChange={(event) => setDraft((current) => current ? { ...current, startTime: event.target.value } : current)} /></AdminField><AdminField label="結束時間"><input type="text" inputMode="numeric" maxLength={5} placeholder="例如 24:00" value={draft.endTime} onChange={(event) => setDraft((current) => current ? { ...current, endTime: event.target.value } : current)} /></AdminField></div> : null}
          <fieldset className="adminDutyRoleChoices"><legend>排班職位</legend>{dutyRoleOptions.map((option) => <div className="adminDutyRoleChoice" key={option.id}><AdminToggle checked={draft.scheduledRoles.includes(option.id)} disabled={!draft.isWorking} onChange={() => toggleRole(option.id)} label={option.label} ariaLabel={`切換${option.label}排班職位`} /><small>{option.description}</small></div>)}</fieldset>
          <div className="adminDutyPlanEditorActions"><AdminButton variant="ghost" onClick={() => setDraft(null)}>取消</AdminButton><AdminButton onClick={() => void save()} disabled={saving}>{saving ? "儲存中…" : draft.id ? "儲存修改" : "送出規劃"}</AdminButton></div>
        </div> : <div className="adminDutyPlanEditorEmpty"><span aria-hidden="true">✦</span><p>值班規劃會保留日期、時段、職位與核准紀錄，讓營業工作台有穩定的當日依據。</p><AdminButton variant="secondary" onClick={() => startNew()}>新增規劃</AdminButton></div>}
      </AdminPanel>
    </div>

    <section className="adminDutyPlanningNote" aria-label="核准流程說明"><strong>流程</strong><span>店員預填</span><i>→</i><span>經理核准／退回</span><i>→</i><span>核准後帶入當日工作身分與 dashboard</span></section>
    <div className="adminDutyPlanningLinks"><AdminButton variant="ghost" onClick={() => navigate("/admin")}>返回營業工作台</AdminButton><AdminButton variant="ghost" onClick={() => navigate("/admin/staff")}>查看店員資料與臨時身分</AdminButton></div>
  </AdminPage>;
}
