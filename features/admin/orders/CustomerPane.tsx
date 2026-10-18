"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton } from "@/features/admin/shared/AdminButton";
import { customerGroups, customerProgress } from "./customerProgress";
import type { CustomerGroupKey, CustomerListItem, CustomerProgress } from "./customerProgress";

type Props = {
  sessions: CustomerListItem[];
  selectedId: string;
  businessDate: string;
  loading: boolean;
  onSelect: (id: string) => void;
  children: ReactNode;
};

export function CustomerPane({ sessions, selectedId, businessDate, loading, onSelect, children }: Props) {
  const paneRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [collapsed, setCollapsed] = useState<Partial<Record<CustomerGroupKey, boolean>>>({});
  const [result, setResult] = useState<{ source: CustomerListItem[]; attempt: number; progress: Record<string, CustomerProgress>; errors: number } | null>(null);
  const [retry, setRetry] = useState(0);
  const [position, setPosition] = useState({ first: 0, last: 0, total: 0, more: false });
  const current = result?.source === sessions && result.attempt === retry ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    const progress: Record<string, CustomerProgress> = {};
    let cursor = 0;
    let errors = 0;
    const worker = async () => {
      while (!controller.signal.aborted && cursor < sessions.length) {
        const item = sessions[cursor++];
        try {
          // Bound concurrent reads; use existing API authority for order progress.
          const orders: unknown = await adminApi.getSessionOrders(item.session.id, controller.signal);
          progress[item.session.id] = customerProgress(orders, item.orderCount);
        } catch {
          if (controller.signal.aborted) return;
          errors++;
          progress[item.session.id] = { group: "unknown", label: "讀取失敗，請重試" };
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, sessions.length) }, worker)).then(() => {
      if (!controller.signal.aborted) setResult({ source: sessions, attempt: retry, progress, errors });
    });
    return () => controller.abort();
  }, [sessions, retry]);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = Math.max(16, pane.getBoundingClientRect().top);
      pane.style.setProperty("--customer-pane-height", `${Math.max(320, window.innerHeight - top - 16)}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    if (pane.parentElement) observer.observe(pane.parentElement);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const measure = () => {
      const bounds = scroller.getBoundingClientRect();
      const rows = [...scroller.querySelectorAll<HTMLButtonElement>(".adminCustomerRow")].filter((row) => row.getClientRects().length > 0);
      const visible = rows.map((row, index) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom > bounds.top && rect.top < bounds.bottom ? index + 1 : 0;
      }).filter(Boolean);
      setPosition({ first: visible[0] || 0, last: visible.at(-1) || 0, total: rows.length,
        more: scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2 });
    };
    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => { observer.disconnect(); scroller.removeEventListener("scroll", measure); };
  }, [sessions, current, collapsed]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [businessDate, sessions]);

  const progressFor = (item: CustomerListItem): CustomerProgress => current?.progress[item.session.id]
    || { group: "unknown", label: "正在讀取訂單狀態…" };

  return <aside className="adminCustomerPane" ref={paneRef} aria-label="顧客與訂單進度">
    {children}
    <div className="adminCustomerProgressNote">
      <span>{!current ? "正在核對訂單進度…" : "依訂單履約分類；帳款另行核對"}</span>
      {Boolean(current?.errors) && <><span role="alert">{current?.errors} 位顧客狀態讀取失敗</span><AdminButton variant="secondary" onClick={() => setRetry((value) => value + 1)}>重試狀態</AdminButton></>}
    </div>
    {/* A scroll region needs its own focus stop for keyboard scrolling without selecting a customer. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className="adminCustomerListScroll" role="region" aria-label="依訂單進度分類的顧客清單" aria-busy={!current || loading} tabIndex={0} ref={scrollRef}>
      <div>{customerGroups.map((group) => {
        const members = sessions.filter((item) => progressFor(item).group === group.key);
        if (!members.length) return null;
        const open = !collapsed[group.key];
        const id = `${listId}-${group.key}`;
        return <section className={`adminCustomerGroup is-${group.key}`} key={group.key}>
          <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setCollapsed((value) => ({ ...value, [group.key]: open }))}>
            <span><ChevronDown size={14} aria-hidden="true" className={open ? "isOpen" : ""} />{group.title}</span><b>{members.length}</b>
          </button>
          <div id={id} hidden={!open}>{members.map((item) => {
            const progress = progressFor(item);
            return <button type="button" key={item.session.id} className={`adminCustomerRow ${selectedId === item.session.id ? "isActive" : ""}`}
              aria-current={selectedId === item.session.id ? "true" : undefined} onClick={() => onSelect(item.session.id)}>
              <span><strong>{item.session.customerName}</strong><small>ID {item.session.gameId}</small><small className="adminCustomerProgressLabel">{progress.label}</small></span>
              <span><b>{item.orderCount} 單</b><small>{Number(item.totalAmount || 0).toLocaleString("zh-TW")} G</small></span>
            </button>;
          })}</div>
        </section>;
      })}{!sessions.length && <p className="adminCustomerListEmpty">{loading ? "正在載入顧客…" : "沒有符合條件的顧客"}</p>}</div>
    </div>
    <div className="adminCustomerListPosition">
      <span>{position.first ? `顯示第 ${position.first}–${position.last} 位／展開 ${position.total} 位` : `展開 ${position.total} 位／共 ${sessions.length} 位`}</span>
      <strong>{position.more ? "↓ 下方還有顧客分類或名單" : "已到清單底部"}</strong>
    </div>
  </aside>;
}
