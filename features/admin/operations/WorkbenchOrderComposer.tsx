"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { errorText, integer, list, record, textValue } from "./workbenchApi";
import { formatMoney } from "./operationsFormat";

export type ComposerMode = "meals" | "rooms" | "renew" | "transfer";
type Product = { id: string; kind: "item" | "set"; name: string; price: number };
type Room = { id: string; name: string; price: number };
type Service = { id: string; name: string; price: number };
type Staff = { id: string; name: string; services: Service[] };
type Catalog = { products: Product[]; rooms: Room[]; staff: Staff[] };
type CartLine = { key: string; product: Product; quantity: number };
type Quote = { token: string; total: number; credit: number; expiresAt: number; source: string };

function parseCatalog(value: unknown): Catalog {
  const c = record(value);
  const menu = record(c.menu);
  const products = list(menu.categories, (entry) => {
    const category = record(entry);
    return list(category.items, (item) => record(item))
      .filter((item) => item.isAvailable !== false && (item.policy == null || record(item.policy).canOrderAlone !== false))
      .map((item): Product => ({ id: textValue(item.id), kind: "item", name: textValue(item.itemName), price: integer(item.price) }));
  }).flat();
  const sets = list(menu.sets, record).filter((item) => item.isOrderable !== false)
    .map((item): Product => ({ id: textValue(item.id), kind: "set", name: textValue(item.setName), price: integer(item.setPrice) }));
  return {
    products: [...products, ...sets],
    rooms: list(c.rooms, record).filter((r) => typeof r.segmentPrice === "number" && r.segmentPrice > 0)
      .map((r) => ({ id: textValue(r.id), name: textValue(r.roomName), price: integer(r.segmentPrice) })),
    staff: list(c.staff, record).filter((s) => s.isNominatable === true).map((s) => ({
      id: textValue(s.id), name: textValue(s.displayName),
      services: [...list(s.commonServices, record), ...list(s.specialServices, record)]
        .filter((x) => x.isNominatable === true && x.price != null)
        .map((x) => ({ id: textValue(x.id), name: textValue(x.serviceName), price: integer(x.price) })),
    })),
  };
}

function parseQuote(value: unknown, source: string): Quote {
  const q = record(value);
  const expiresAt = Date.parse(textValue(q.expiresAt));
  if (!Number.isFinite(expiresAt)) throw new Error("報價有效時間格式異常。");
  return { token: textValue(q.quoteToken), total: integer(q.totalAmount), credit: integer(q.mealCreditApplied), expiresAt, source };
}

function taipeiNextStart(): string {
  const value = new Date(Math.ceil((Date.now() + 20 * 60_000) / 600_000) * 600_000 + 8 * 3_600_000);
  return value.toISOString().slice(0, 16);
}

export function WorkbenchOrderComposer({ sessionId, businessDate, mode, staffId: ownStaffId, onSaved, onBusy }: {
  sessionId: string; businessDate: string; mode: ComposerMode; staffId: string;
  onSaved: () => Promise<void>; onBusy: (busy: boolean) => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const retryOrder = useRef<Record<string, unknown> | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productKey, setProductKey] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [staffId, setStaffId] = useState(mode === "renew" ? ownStaffId : "");
  const [serviceId, setServiceId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [segments, setSegments] = useState(1);
  const [participants, setParticipants] = useState(1);
  const [startsAt, setStartsAt] = useState(taipeiNextStart);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    adminApi.getOrderingCatalog(businessDate, controller.signal)
      .then((value: unknown) => { if (!controller.signal.aborted) setCatalog(parseCatalog(value)); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [businessDate]);
  const staff = catalog?.staff.find((s) => s.id === staffId);
  const body = {
    meals: mode === "meals" ? cart.map(({ product, quantity: count }) => ({ referenceId: product.id, kind: product.kind, quantity: count })) : [],
    rooms: mode === "rooms" && roomId ? [{ roomId, segmentCount: segments, requestedStartsAt: `${startsAt}:00+08:00` }] : [],
    nominations: (mode === "renew" || mode === "transfer") && staffId ? [{ staffId, mode: serviceId ? "service" : "companionship", serviceId: serviceId || null, segmentCount: segments, participantCount: participants, requestedStartsAt: `${startsAt}:00+08:00` }] : [],
    tips: [], customerNote: note.trim() || null, customerLocation: location.trim() || null,
    isManagerTransfer: mode === "transfer",
  };
  const source = JSON.stringify(body);
  const validQuote = quote?.source === source && quote.expiresAt > now ? quote : null;
  const hasLines = body.meals.length + body.rooms.length + body.nominations.length > 0;
  const submit = async () => {
    if (lock.current || submitted || !hasLines) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      if (retryOrder.current) {
        await adminApi.submitAssistedOrder(sessionId, retryOrder.current);
        retryOrder.current = null; setUncertain(false); setSubmitted(true);
        await onSaved();
      } else if (!validQuote || validQuote.expiresAt <= Date.now()) {
        setQuote(parseQuote(await adminApi.quoteAssistedOrder(sessionId, body), source));
      } else {
        retryOrder.current = { ...body, quoteToken: validQuote.token };
        await adminApi.submitAssistedOrder(sessionId, retryOrder.current);
        retryOrder.current = null; setUncertain(false);
        setSubmitted(true);
        await onSaved();
      }
    } catch (e) {
      setError(errorText(e));
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) retryOrder.current = null;
      setUncertain(Boolean(retryOrder.current));
    }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <form className="dwForm" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
    {mode === "renew" && <p className="dwHint">續時建立新的指名請求，仍需確認承接；加購不會延長原指名。</p>}
    {mode === "transfer" && <p className="dwHint">建立新承接請求，由收到請求的人員確認；無法承接時交回經理協調。</p>}
    {!catalog && <p role="status">{error ? "菜單載入失敗，請關閉後重新開啟。" : "載入菜單與可用時段…"}</p>}
    {catalog && <fieldset disabled={busy || submitted || uncertain}>
      {mode === "meals" ? <>
        <div className="dwFormGrid">
          <AdminField label="餐點／套餐"><select value={productKey} onChange={(e) => setProductKey(e.target.value)}>
            <option value="">選擇餐點</option>{catalog.products.map((p) => <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.name} · {formatMoney(p.price)}</option>)}
          </select></AdminField>
          <AdminField label="數量"><input type="number" min={1} max={99} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></AdminField>
        </div>
        <AdminButton variant="secondary" disabled={!productKey || !Number.isInteger(quantity) || quantity < 1 || quantity > 99} onClick={() => {
          const product = catalog.products.find((p) => `${p.kind}:${p.id}` === productKey);
          if (product) setCart((current) => [...current, { key: crypto.randomUUID(), product, quantity }]);
        }}>加入餐點</AdminButton>
        <div className="dwList">{cart.map((line) => <div className="dwRow" key={line.key}><strong>{line.product.name} × {line.quantity}</strong><AdminButton variant="ghost" onClick={() => setCart((c) => c.filter((x) => x.key !== line.key))}>移除</AdminButton></div>)}</div>
      </> : <>
        {(mode === "renew" || mode === "transfer") && <>
          <AdminField label="指名人員" required><select required value={staffId} disabled={mode === "renew"} onChange={(e) => { setStaffId(e.target.value); setServiceId(""); }}>
            <option value="">選擇人員</option>{catalog.staff.filter((s) => mode === "transfer" || s.id === ownStaffId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></AdminField>
          <AdminField label="服務"><select value={serviceId} onChange={(e) => setServiceId(e.target.value)}><option value="">純陪伴</option>{staff?.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatMoney(s.price)}</option>)}</select></AdminField>
          <AdminField label="人數"><input required type="number" min={1} max={20} value={participants} onChange={(e) => setParticipants(Number(e.target.value))} /></AdminField>
        </>}
        {mode === "rooms" && <AdminField label="包廂" required><select required value={roomId} onChange={(e) => setRoomId(e.target.value)}><option value="">選擇包廂</option>{catalog.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} · {formatMoney(r.price)}／節</option>)}</select></AdminField>}
        <div className="dwFormGrid">
          <AdminField label="開始時間（台灣時間）" required><input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></AdminField>
          <AdminField label="節數" required><input required type="number" min={1} max={72} value={segments} onChange={(e) => setSegments(Number(e.target.value))} /></AdminField>
        </div>
      </>}
      <AdminField label="顧客位置"><input maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例如 A 區 3 號桌" /></AdminField>
      <AdminField label="備註"><textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></AdminField>
    </fieldset>}
    {validQuote && <div className="dwNotice" role="status">正式報價 <strong>{formatMoney(validQuote.total)}</strong> · 餐費折抵 {formatMoney(validQuote.credit)}<small>送出時再次檢查時段及報價有效期限。</small></div>}
    {error && <p className="adminFormError" role="alert">{error}</p>}
    <AdminButton type="submit" disabled={busy || !catalog || !hasLines || submitted}>{busy ? "處理中…" : uncertain ? "查回／重試同一張訂單" : validQuote ? "確認報價並送出" : "取得正式報價"}</AdminButton>
  </form>;
}
