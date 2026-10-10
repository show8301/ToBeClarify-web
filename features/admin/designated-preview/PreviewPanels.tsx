import { Check, Clock3, Coffee, DoorOpen, Plus, Ticket, PenLine, ArrowUpRight } from "lucide-react";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { STATUS_LABELS, formatGil } from "./preview-data";
import type { ActionRequest, PreviewGuest, ServiceStatus } from "./preview-data";

interface PanelProps {
  guests: PreviewGuest[];
  selected: PreviewGuest;
  onSelect: (id: string) => void;
  onAction: (request: ActionRequest) => void;
  onStatus: (id: string, status: ServiceStatus) => void;
  onDeparture: (id: string) => void;
}

export function StatusBadge({ guest }: { guest: PreviewGuest }) {
  return <span className={`dpBadge is-${guest.status}`}>{STATUS_LABELS[guest.status]}</span>;
}

export function RequestsPanel({ guests, onSelect, onAction, onStatus }: PanelProps) {
  const requests = guests.filter((guest) => guest.status === "awaiting");
  return (
    <AdminPanel title="等待我確認" description="直接指名與經理轉單，都在這裡回覆。" actions={<span className="dpCount">{requests.length}</span>}>
      <div className="dpRequestList">
        {requests.map((guest) => (
          <article className="dpRequest" key={guest.id}>
            <div className="dpRowBetween">
              <button className="dpNameButton" onClick={() => onSelect(guest.id)} type="button">{guest.name}<ArrowUpRight size={16} aria-hidden="true" /></button>
              <span className={`dpBadge ${guest.source === "經理轉單" ? "is-manager" : ""}`}>{guest.source}</span>
            </div>
            <p className="dpRequestTime">{guest.start}–{guest.end}<span>{guest.service}</span></p>
            <p className="dpMuted">{guest.reason || `${guest.gameId} · ${guest.location}`}</p>
            <div className="dpActions">
              <AdminButton onClick={() => onStatus(guest.id, "confirmed")}><Check size={16} aria-hidden="true" />確認承接</AdminButton>
              <AdminButton variant="ghost" onClick={() => onAction({ action: "decline", guestId: guest.id })}>無法承接</AdminButton>
            </div>
          </article>
        ))}
        {!requests.length && <p className="dpEmpty"><Check size={22} aria-hidden="true" />指名已全部回覆</p>}
      </div>
    </AdminPanel>
  );
}

export function CurrentService({ guests, onAction, onStatus, onSelect, focus = false }: PanelProps & { focus?: boolean }) {
  const current = guests.find((guest) => guest.status === "in_service");
  const next = guests.find((guest) => guest.status === "confirmed");
  if (!current) {
    return (
      <AdminPanel title="目前服務" description="準備好後，開始下一位顧客的服務。">
        {next ? (
          <div className="dpServiceBody">
            <div><h3>{next.name}</h3><p>{next.start}–{next.end} · {next.service}</p></div>
            <AdminButton onClick={() => onStatus(next.id, "in_service")}>開始服務</AdminButton>
          </div>
        ) : <p className="dpEmpty">目前沒有進行中的服務</p>}
      </AdminPanel>
    );
  }
  const remaining = current.id === "moon" ? 16 : 20;
  return (
    <AdminPanel title="目前服務" description="掌握這一段服務與結束後的安排。" actions={<StatusBadge guest={current} />} className={focus ? "dpServiceFocus" : ""}>
      <div className="dpServiceBody">
        <div className="dpServiceCustomer">
          <span className="dpAvatar" aria-hidden="true">{current.name.slice(0, 1)}</span>
          <div><h3>{current.name}</h3><p>{current.gameId}</p><span className="dpMuted">{current.location}</span></div>
        </div>
        <div className="dpTimer"><span>預計剩餘</span><strong>{remaining}<small>分</small></strong><span>{current.start}–{current.end}</span></div>
      </div>
      <div className="dpProgress" role="img" aria-label={`範例服務預計剩餘 ${remaining} 分鐘`}><span style={{ width: current.id === "moon" ? "60%" : "0%" }} /></div>
      <div className="dpServiceMeta"><span><Coffee size={16} aria-hidden="true" />{current.service}</span><span>服務後休息 10 分鐘</span></div>
      <p className="dpNote">{current.note}</p>
      <div className="dpActions">
        <AdminButton onClick={() => onStatus(current.id, "completed")}><Check size={16} aria-hidden="true" />完成服務</AdminButton>
        <AdminButton variant="secondary" onClick={() => onAction({ action: "addon", guestId: current.id })}><Plus size={16} aria-hidden="true" />加點服務</AdminButton>
        <AdminButton variant="ghost" onClick={() => onAction({ action: "extend", guestId: current.id })}>續約指名</AdminButton>
      </div>
      {focus && (
        <div className="dpFocusAssist">
          <span>這位顧客需要協助？</span>
          <AdminButton variant="ghost" onClick={() => onSelect(current.id)}>開啟顧客處理<ArrowUpRight size={16} aria-hidden="true" /></AdminButton>
        </div>
      )}
    </AdminPanel>
  );
}

export function SchedulePanel({ guests, onSelect, expanded = false }: { guests: PreviewGuest[]; onSelect: (id: string) => void; expanded?: boolean }) {
  const active = guests.filter((guest) => guest.status !== "completed");
  return (
    <AdminPanel title="我的今日排程" description="22:00–01:00 · 每段服務後休息 10 分鐘" className={expanded ? "dpScheduleWide" : ""}>
      <div className="dpTimeline">
        {(expanded ? [...guests].sort((a, b) => a.start.localeCompare(b.start)) : active).map((guest) => (
          <button type="button" className={`dpTimelineItem is-${guest.status}`} key={guest.id} onClick={() => onSelect(guest.id)}>
            <span className="dpTimelineTime">{guest.start}<small>{guest.end}</small></span>
            <span className="dpTimelineDot" aria-hidden="true" />
            <span className="dpTimelineCopy"><strong>{guest.name}</strong><small>{guest.service}</small></span>
            <StatusBadge guest={guest} />
          </button>
        ))}
      </div>
      {!expanded && (
        <details className="dpDisclosure">
          <AdminDisclosureSummary>已完成的服務</AdminDisclosureSummary>
          <div className="dpCompleted">
            {guests.filter((guest) => guest.status === "completed").map((guest) => (
              <p key={guest.id}>{guest.start}–{guest.end} · {guest.name} · {guest.service}</p>
            ))}
          </div>
        </details>
      )}
    </AdminPanel>
  );
}

export function GuestList({ guests, selected, onSelect }: PanelProps) {
  const pending = guests.filter((guest) => guest.status === "awaiting").length;
  return (
    <AdminPanel title="營業中的顧客" description="選擇顧客，右側直接處理。" actions={<span className="dpCount">{guests.length}</span>} className="dpGuestListPanel">
      <div className="dpListSectionLabel">待回覆 {pending} · 服務中 {guests.filter((guest) => guest.status === "in_service").length}</div>
      <div className="dpGuestList">
        {guests.map((guest) => (
          <button type="button" key={guest.id} className={`dpGuestRow ${selected.id === guest.id ? "isSelected" : ""}`} aria-pressed={selected.id === guest.id} onClick={() => onSelect(guest.id)}>
            <span className="dpAvatar" aria-hidden="true">{guest.name.slice(0, 1)}</span>
            <span className="dpGuestRowCopy"><strong>{guest.name}</strong><small>{guest.start}–{guest.end}</small><span>{guest.departed ? "已離店 · 點餐關閉" : guest.location}</span></span>
            <StatusBadge guest={guest} />
          </button>
        ))}
      </div>
    </AdminPanel>
  );
}

export function GuestDesk({ selected: guest, guests, onAction, onDeparture, onStatus }: PanelProps) {
  return (
    <AdminPanel title="顧客處理" description="本次來店的資訊與現場需求。" actions={<span className={`dpBadge ${guest.departed ? "" : "is-confirmed"}`}>{guest.departed ? "已離店" : "在店中"}</span>}>
      <div className="dpGuestHeading">
        <span className="dpAvatar" aria-hidden="true">{guest.name.slice(0, 1)}</span>
        <div><h3>{guest.name}</h3><p>{guest.gameId} · {guest.location}</p></div>
        <StatusBadge guest={guest} />
      </div>
      <p className="dpNote">{guest.note}</p>
      <div className="dpOrderSummary">
        <div><small>本次指名</small><strong>{guest.service}</strong><span>{guest.start}–{guest.end}</span></div>
        <div><small>訂單金額</small><strong>{formatGil(guest.amount)}</strong><span>{guest.order}</span></div>
      </div>
      {guest.status === "in_service" && (
        <p className="dpDeskServiceTime">
          <Clock3 size={16} aria-hidden="true" />
          預計剩餘 {guest.id === "moon" ? 16 : 20} 分鐘 · 服務後休息 10 分鐘
        </p>
      )}
      {guest.status === "awaiting" && (
        <div className="dpInlineRequest">
          <p>{guest.reason || "顧客已送出指名，等待你的回覆。"}</p>
          <div className="dpActions">
            <AdminButton onClick={() => onStatus(guest.id, "confirmed")}>確認承接</AdminButton>
            <AdminButton variant="ghost" onClick={() => onAction({ action: "decline", guestId: guest.id })}>無法承接</AdminButton>
          </div>
        </div>
      )}
      {guest.status === "confirmed" && (
        <div className="dpActions">
          <AdminButton disabled={guests.some((item) => item.status === "in_service")} onClick={() => onStatus(guest.id, "in_service")}>開始服務</AdminButton>
          <span className="dpMuted">{guests.some((item) => item.status === "in_service") ? "完成目前服務後即可開始" : "準備好後開始這一段服務"}</span>
        </div>
      )}
      {guest.status === "manager" && <p className="dpNote">已回覆無法承接，等待經理協調後續安排。</p>}
      {guest.status === "in_service" && (
        <div className="dpActions">
          <AdminButton onClick={() => onStatus(guest.id, "completed")}>完成服務</AdminButton>
          <AdminButton variant="secondary" onClick={() => onAction({ action: "addon", guestId: guest.id })}>加點服務</AdminButton>
          <AdminButton variant="ghost" onClick={() => onAction({ action: "extend", guestId: guest.id })}>續約指名</AdminButton>
        </div>
      )}
      <div className="dpDeskSection">
        <h4>現場協助</h4><div className="dpAssistGrid">
        <AdminButton variant="ghost" disabled={guest.departed} onClick={() => onAction({ action: "pass", guestId: guest.id })}><Ticket size={18} aria-hidden="true" />重發點餐碼</AdminButton>
        <AdminButton variant="ghost" disabled={guest.departed} onClick={() => onAction({ action: "meal", guestId: guest.id })}><Coffee size={18} aria-hidden="true" />代點餐點</AdminButton>
        <AdminButton variant="ghost" disabled={guest.departed} onClick={() => onAction({ action: "room", guestId: guest.id })}><DoorOpen size={18} aria-hidden="true" />代訂包廂</AdminButton>
        <AdminButton variant="ghost" disabled={guest.departed} onClick={() => onAction({ action: "commission", guestId: guest.id })}><PenLine size={18} aria-hidden="true" />建立繪圖／簽繪委託</AdminButton>
      </div></div>
      <div className="dpDeparture">
        <div>
          <strong>{guest.departed ? "顧客已離店" : "顧客離店"}</strong>
          <p>{guest.departed ? "需要再點餐時，重新開放本次點餐碼。" : "離店後關閉點餐，保留本次訂單供查看。"}</p>
        </div>
        <AdminButton variant="ghost" disabled={!guest.departed && guest.status === "in_service"} onClick={() => onDeparture(guest.id)}>
          {guest.departed ? "重新開放點餐" : "標記離店"}
        </AdminButton>
      </div>
      <details className="dpDisclosure">
        <AdminDisclosureSummary>異常與調整</AdminDisclosureSummary>
        <div className="dpActions">
          <AdminButton variant="ghost" onClick={() => onAction({ action: "exception", guestId: guest.id })}>協調改期／補登／取消未服務項目</AdminButton>
        </div>
      </details>
    </AdminPanel>
  );
}

export function NextService({ guests, onSelect }: { guests: PreviewGuest[]; onSelect: (id: string) => void }) {
  const next = guests.find((guest) => guest.status === "confirmed" || guest.status === "awaiting");
  return (
    <div className="dpNext">
      <Clock3 size={20} aria-hidden="true" />
      <div>
        <span>下一段安排</span>
        <strong>{next ? `${next.start} · ${next.name}` : "目前沒有下一段安排"}</strong>
        <p>{next ? `${next.service} · ${STATUS_LABELS[next.status]}` : "可以先處理顧客需求"}</p>
      </div>
      {next && <AdminButton variant="ghost" onClick={() => onSelect(next.id)}>查看</AdminButton>}
    </div>
  );
}
