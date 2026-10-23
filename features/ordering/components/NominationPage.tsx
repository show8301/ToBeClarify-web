"use client";

import { useMemo, useState } from "react";
import { InlineHelp } from "@/components/InlineHelp";
import { OrderPageHeading } from "./OrderPageHeading";
import { NominationModeCard } from "./NominationModeCard";
import { availableStarts, nominationStatus } from "../nomination-availability";
import { useNominationAvailability } from "../useNominationAvailability";

type Service = {
  id: string; serviceName: string; serviceDescription: string; price: number | null;
  durationMinutes: number | null; isNominatable: boolean; additionalPersonPrice: number | null;
};
type Staff = {
  id: string; displayName: string; avatarUrl: string | null; isNominatable: boolean;
  isWorkingToday: boolean; todayShift?: string | null; commonServices: Service[]; specialServices: Service[];
};
type NominationLine = {
  id: string; mode: "companionship" | "service"; staffId: string; staffName: string;
  serviceId: string | null; serviceName: string; segments: number; participants: number;
  startsAt: string; duration: number; baseFee: number; baseTotal: number; serviceUnit: number;
  serviceTotal: number; serviceRemoved: boolean; baseRemoved: boolean;
};
type Cart = { nominations: NominationLine[] };
type Props = {
  token: string; session: { maxNominatedStaff: number; businessDate: string };
  settings: { segmentMinutes: number; baseNominationFee: number }; staff: Staff[];
  cart: Cart; setCart: (update: (current: Cart) => Cart) => void;
  onNotice: (notice: { message: string; error: boolean }) => void;
};

const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;
const timeFormat = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
const clock = (value: string) => timeFormat.format(new Date(value));

export function NominationPage({ token, session, settings, staff, cart, setCart, onNotice }: Props) {
  const [staffId, setStaffId] = useState("");
  const [mode, setMode] = useState<"companionship" | "service">("companionship");
  const [serviceId, setServiceId] = useState("");
  const [segments, setSegments] = useState(1);
  const [participants, setParticipants] = useState(1);
  const [startsAt, setStartsAt] = useState("");
  const [revision, setRevision] = useState(0);
  const { data, error, now } = useNominationAvailability(token, session.businessDate, revision);
  const minimumMinutes = settings.segmentMinutes;
  const visibleStaff = staff.filter(person => {
    const live = data?.staff.find(item => item.staffId === person.id);
    return live ? Boolean(live.shiftStartsAt) || person.isNominatable : person.isNominatable || person.todayShift;
  });
  const selectedStaff = visibleStaff.find(person => person.id === (staffId || visibleStaff[0]?.id));
  const availability = data?.staff.find(person => person.staffId === selectedStaff?.id);
  const services = [...(selectedStaff?.commonServices || []), ...(selectedStaff?.specialServices || [])]
    .filter(item => item.isNominatable && item.price !== null);
  const service = services.find(item => item.id === serviceId);
  const minimumSegments = service?.durationMinutes ? Math.ceil(service.durationMinutes / settings.segmentMinutes) : 1;
  const safeSegments = Math.max(segments, minimumSegments);
  const duration = safeSegments * settings.segmentMinutes;
  const minuteNow = Math.floor(now / 60_000) * 60_000;
  const options = useMemo(() => availableStarts(availability, duration, minuteNow), [availability, duration, minuteNow]);
  const closeAt = data?.projectedCloseAt;
  const bufferMinutes = availability?.bufferMinutes || 0;
  const optionElements = useMemo(() => options.map(start => <option key={start} value={start}>
    {clock(start)}{closeAt && Date.parse(start) + (duration + bufferMinutes) * 60_000 > Date.parse(closeAt) ? "（須店家確認）" : ""}
  </option>), [options, closeAt, duration, bufferMinutes]);
  const chosenStart = startsAt || options[0] || "";
  const validStart = options.includes(chosenStart) && Date.parse(chosenStart) > now;
  const serviceUnit = service ? Number(service.price) + Math.max(0, participants - 1) * Number(service.additionalPersonPrice || 0) : 0;
  const baseTotal = settings.baseNominationFee * safeSegments;
  const serviceTotal = mode === "service" && service ? serviceUnit * (service.durationMinutes ? 1 : safeSegments) : 0;
  const requiresCoordination = Boolean(data?.projectedCloseAt && validStart
    && Date.parse(chosenStart) + (duration + (availability?.bufferMinutes || 0)) * 60_000 > Date.parse(data.projectedCloseAt));
  const disabledReason = !data ? error || "確認可預約時段中…" : data.nominationPaused ? "目前暫停接受新指名，請洽店員。"
    : !availability?.isAccepting ? "此店員暫停接受新指名。"
    : availability.isOverdue ? "此店員的服務尚未結束，請稍後再確認可預約時段。"
    : mode === "service" && !service ? "請先選擇服務項目。"
    : !options.length ? "目前沒有足以安排所選服務及緩衝時間的空檔，請調整服務內容或選擇其他店員。"
    : !validStart ? "原選時段已無法預約，請重新選擇時間。" : "";

  const add = () => {
    if (disabledReason || !selectedStaff) return onNotice({ message: disabledReason || "請先選擇店員。", error: true });
    if (cart.nominations.filter(line => !line.baseRemoved).length >= session.maxNominatedStaff)
      return onNotice({ message: `本次最多可同時指名 ${session.maxNominatedStaff} 位店員。`, error: true });
    if (cart.nominations.some(line => line.staffId === selectedStaff.id && !line.baseRemoved))
      return onNotice({ message: "同一張訂單每位店員只能加入一次；追加時數請另開新訂單。", error: true });
    setCart(current => ({ ...current, nominations: [...current.nominations, {
      id: crypto.randomUUID(), mode, staffId: selectedStaff.id, staffName: selectedStaff.displayName,
      serviceId: mode === "service" ? service?.id || null : null,
      serviceName: mode === "service" ? service?.serviceName || "" : "純陪伴",
      segments: safeSegments, participants, startsAt: chosenStart, duration,
      baseFee: settings.baseNominationFee, baseTotal, serviceUnit: mode === "service" ? serviceUnit : 0,
      serviceTotal, serviceRemoved: false, baseRemoved: false,
    }] }));
    onNotice({ message: requiresCoordination ? "已加入本次點餐；所選時段超過預計關店時間，送出後須由店家確認是否承接。"
      : "指名服務已加入本次點餐；送出時會再次確認時段是否可預約。", error: false });
  };

  return <div className="orderPage">
    <OrderPageHeading kicker="STAFF FIRST" title="指名服務" text={`先選店員，再查看服務與可預約時間。每節 ${settings.segmentMinutes} 分鐘，最多同時指名 ${session.maxNominatedStaff} 人。`} />
    <section className="nominationSection">
      <header><span>01</span><div className="orderSectionTitle"><h2>選擇店員</h2><InlineHelp title="選擇店員說明">可提前預約店員班內的空檔，實際可選時段依服務時間而定。</InlineHelp></div></header>
      <div className="nominationStaffGrid">{visibleStaff.map(person => {
        const live = data?.staff.find(item => item.staffId === person.id);
        const possible = data && !data.nominationPaused && availableStarts(live, minimumMinutes, minuteNow).length > 0;
        const label = data?.nominationPaused ? "暫停接受新指名" : nominationStatus(live, minimumMinutes, now, data?.projectedCloseAt || null);
        return <button type="button" key={person.id} disabled={!possible} aria-pressed={selectedStaff?.id === person.id}
          className={selectedStaff?.id === person.id ? "isActive" : ""} onClick={() => {
            setStaffId(person.id); setServiceId(""); setSegments(1); setMode("companionship"); setStartsAt("");
          }}>
          <span>{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : person.displayName.slice(0, 1)}</span>
          <strong>{person.displayName}</strong><small>{label}</small>
          {possible && label === "今日預約已滿" && <small>關店後時段須店家確認</small>}
        </button>;
      })}</div>
      {!visibleStaff.length && <p>本日沒有可預約的店員。</p>}
      {error && <p role="alert">暫時無法確認可預約時段，請稍後再試。</p>}
      <button type="button" onClick={() => setRevision(value => value + 1)}>重新確認可預約時段</button>
    </section>
    {selectedStaff && <>
      <section className="nominationSection">
        <header><span>02</span><div className="orderSectionTitle"><h2>選擇指名方式（二擇一）</h2><InlineHelp title="選擇指名方式說明">純陪伴只收基礎指名費；服務成立後仍可在原本時段內追加服務，不會再收一次基礎費。</InlineHelp></div></header>
        <div className="nominationModeGrid">
          <NominationModeCard kicker="COMPANIONSHIP" title="純陪伴" description="先保留陪伴時段，稍後再視現場需求追加服務。" selected={mode === "companionship"} onSelect={() => { setMode("companionship"); setServiceId(""); setSegments(1); setStartsAt(""); }} />
          <NominationModeCard kicker="SERVICE" title="指名+加購服務" description="現在就選擇服務；基礎指名費與服務費分列。" selected={mode === "service"} onSelect={() => { setMode("service"); setStartsAt(""); }} />
        </div>
        {mode === "service" && <div className="nominationServiceGrid">{services.map(item => <button type="button" key={item.id}
          className={serviceId === item.id ? "isActive" : ""} onClick={() => { setServiceId(item.id); setSegments(item.durationMinutes ? Math.ceil(item.durationMinutes / settings.segmentMinutes) : 1); setStartsAt(""); }}>
          <span>SERVICE</span><strong>{item.serviceName}</strong><p>{item.serviceDescription}</p><footer><b>{money(item.price || 0)}</b><small>{item.durationMinutes ? `${item.durationMinutes} 分鐘／單次` : "每節計費"}</small></footer>
        </button>)}</div>}
      </section>
      <section className="nominationSection">
        <header><span>03</span><div><h2>選擇時間</h2><p>{selectedStaff.displayName}｜{mode === "service" ? service?.serviceName || "請先選擇服務項目" : "純陪伴"}</p></div></header>
        <div className="nominationControls">
          <label>預約開始時間<select value={chosenStart} disabled={!options.length || !data || data.nominationPaused} onChange={event => setStartsAt(event.target.value)} aria-describedby="nomination-time-help">
            {!validStart && <option value={chosenStart}>{chosenStart ? "原選時段已無法預約，請重新選擇" : "目前沒有可預約時段"}</option>}
            {optionElements}
          </select></label>
          <label htmlFor="nomination-segments">節數<div className="stepper"><button type="button" aria-label="減少節數" onClick={() => setSegments(Math.max(minimumSegments, safeSegments - 1))}>−</button><strong><output id="nomination-segments">{safeSegments}</output></strong><button type="button" aria-label="增加節數" onClick={() => setSegments(Math.min(72, safeSegments + 1))}>＋</button></div><small>涵蓋 {duration} 分鐘{service?.durationMinutes ? `；服務需 ${service.durationMinutes} 分鐘` : ""}</small></label>
          {mode === "service" && <label htmlFor="nomination-participants">參與人數<div className="stepper"><button type="button" aria-label="減少參與人數" onClick={() => setParticipants(Math.max(1, participants - 1))}>−</button><strong><output id="nomination-participants">{participants}</output></strong><button type="button" aria-label="增加參與人數" onClick={() => setParticipants(Math.min(20, participants + 1))}>＋</button></div></label>}
        </div>
        <p id="nomination-time-help" role="status">{disabledReason || (requiresCoordination ? "所選時段超過預計關店時間，送出後須由店家確認是否承接。" : "僅顯示能完整安排服務及緩衝時間的班內空檔。")}</p>
        <div className="nominationPrice"><div><span>基礎指名費</span><b>{money(settings.baseNominationFee)} × {safeSegments} 節</b><strong>{money(baseTotal)}</strong></div>
          <div><span>服務費</span><b>{mode === "service" ? `${money(serviceUnit)} ${service?.durationMinutes ? "× 1 次" : `× ${safeSegments} 節`}` : "稍後可在我的訂單追加"}</b><strong>{money(serviceTotal)}</strong></div>
          <footer><span>本項合計</span><strong>{money(baseTotal + serviceTotal)}</strong></footer>
        </div>
        <button className="orderPrimaryAction" type="button" disabled={Boolean(disabledReason)} onClick={add}>加入本次點餐</button>
      </section>
    </>}
  </div>;
}
