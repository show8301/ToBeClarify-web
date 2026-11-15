"use client";

import { useEffect, useState } from "react";
import { calendarStatusLabels, calendarTimeRange, getBusinessCalendar, shiftMonth } from "../calendar";
import type { BusinessCalendar as CalendarData } from "../calendar";

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

export default function BusinessCalendar() {
  const [month, setMonth] = useState("");
  const [data, setData] = useState<CalendarData | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const next = await getBusinessCalendar(month, controller.signal);
        if (!controller.signal.aborted) setData(next);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(failure instanceof Error ? failure.message : "行事曆載入失敗。");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(() => void load(), 60000);
        }
      }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [month, reload]);

  const visible = data && (!month || month === data.month) ? data : null;
  const currentMonth = visible?.month || month;
  const selected = visible?.days.find(day => day.businessDate === selectedDate)
    || visible?.days.find(day => day.businessDate === visible.today) || visible?.days[0];
  const offset = currentMonth ? new Date(`${currentMonth}-01T12:00:00Z`).getUTCDay() : 0;
  const title = currentMonth ? `${Number(currentMonth.slice(0, 4))} 年 ${Number(currentMonth.slice(5))} 月` : "讀取月份中…";
  const changeMonth = (next: string) => { setMonth(next); setSelectedDate(""); setError(""); setLoading(true); };

  return <section className="live-calendar" aria-labelledby="business-calendar-title">
    <header>
      <div><span className="section-kicker">BUSINESS CALENDAR</span><h2 id="business-calendar-title">營業與值班行事曆</h2></div>
      <p>查看已公告的營業安排與預定班表。未公告的日期不代表休店；即時執勤狀態請以上方卡片為準。</p>
    </header>
    <div className="live-calendar-toolbar">
      <h3 aria-live="polite">{title}</h3>
      <div role="group" aria-label="選擇行事曆月份">
        <button type="button" disabled={!currentMonth || currentMonth <= "1900-01"} onClick={() => changeMonth(shiftMonth(currentMonth, -1))}>上個月</button>
        <button type="button" onClick={() => { changeMonth(""); setReload(value => value + 1); }}>回到本月</button>
        <button type="button" disabled={!currentMonth || currentMonth >= "9998-12"} onClick={() => changeMonth(shiftMonth(currentMonth, 1))}>下個月</button>
      </div>
    </div>
    <p className="live-calendar-note">台北時間・跨午夜班次歸原營業日・每 60 秒更新</p>
    {error ? <div className="live-calendar-message" role="alert">{error} <button type="button" onClick={() => setReload(value => value + 1)}>重新查詢</button></div> : null}
    {loading ? <p role="status">正在更新營業行事曆…</p> : null}
    {visible ? <>
      <div className="live-calendar-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="live-calendar-grid" role="group" aria-label={`${title}營業日期`}>
        {Array.from({ length: offset }, (_, index) => <div className="live-calendar-spacer" key={`blank-${index}`} />)}
        {visible.days.map(day => <button type="button" key={day.businessDate}
          className={`live-calendar-day is-${day.status}${day.businessDate === visible.today ? " is-today" : ""}`}
          aria-pressed={selected?.businessDate === day.businessDate}
          aria-label={`${day.businessDate}，${calendarStatusLabels[day.status]}，${day.staff.length} 位店員已排班`}
          onClick={() => setSelectedDate(day.businessDate)}>
          <strong>{Number(day.businessDate.slice(-2))}{day.businessDate === visible.today ? <small>今天</small> : null}</strong>
          <span className="live-calendar-state">{calendarStatusLabels[day.status]}</span>
          {day.startsAt && day.endsAt ? <span className="live-calendar-time">{calendarTimeRange(day.startsAt, day.endsAt)}</span> : null}
          <span className="live-calendar-names">{day.staff.slice(0, 2).map(person => person.displayName).join("、")}{day.staff.length > 2 ? `・另有 ${day.staff.length - 2} 位` : ""}</span>
          {day.staff.length ? <span className="live-calendar-count">{day.staff.length} 位排班</span> : null}
        </button>)}
      </div>
      {selected ? <div className="live-calendar-detail" aria-live="polite">
        <h3>{selected.businessDate} <span>{calendarStatusLabels[selected.status]}</span></h3>
        <p>{selected.startsAt && selected.endsAt ? `營業時段：${calendarTimeRange(selected.startsAt, selected.endsAt)}` : "當日營業安排尚未公告。"}</p>
        <h4>預定上班店員</h4>
        {selected.staff.length ? <ul>{selected.staff.map(person => <li key={person.staffId}>
          <img src={person.avatarUrl || "/og.png"} alt="" width={48} height={48} loading="lazy" />
          <div><a href={`/staff/${encodeURIComponent(person.staffId)}`}>{person.displayName}</a><span>{calendarTimeRange(person.startsAt, person.endsAt)}</span></div>
        </li>)}</ul> : <p>當日尚無已公布的店員班表。</p>}
      </div> : null}
    </> : null}
  </section>;
}
