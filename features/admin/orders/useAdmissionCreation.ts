import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, ApiError } from "@/features/admin/api/client.js";
import { admissionCreationApi } from "./admission-creation-api";
import { parseIssuedAdmission } from "./admission-creation-contract";
import type { AdmissionCreationMode, AdmissionCreationResult, AdmissionPreview, CreateAdmissionSessionRequest, IssuedAdmissionSession } from "./admission-creation-types";

export function useAdmissionCreation(onIssued: (issued: IssuedAdmissionSession) => void, onBusyChange?: (busy: boolean) => void) {
  const [preview, setPreview] = useState<AdmissionPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CreateAdmissionSessionRequest | null>(null);
  const [result, setResult] = useState<AdmissionCreationResult | null>(null);
  const [mode, setMode] = useState<AdmissionCreationMode>("received");
  const [discount, setDiscount] = useState(0);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false);
  const previewRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (signal?: AbortSignal) => {
    previewRequest.current?.abort();
    const controller = new AbortController();
    previewRequest.current = controller;
    const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    setPreview(null); setConfirmed(false); setError("");
    try { const value = await admissionCreationApi.preview(requestSignal); if (!requestSignal.aborted) setPreview(value); }
    catch (e) { if (!requestSignal.aborted) setError(e instanceof Error ? e.message : "無法讀取入場費。"); }
  }, []);
  useEffect(() => { const c = new AbortController(); const timer = window.setTimeout(() => void load(c.signal), 0); return () => { window.clearTimeout(timer); c.abort(); previewRequest.current?.abort(); }; }, [load]);
  const locked = busy || Boolean(pending);
  useEffect(() => { onBusyChange?.(locked); }, [locked, onBusyChange]);
  useEffect(() => {
    if (!locked) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [locked]);
  const received = mode === "received" ? Math.max(0, (preview?.admissionAmount ?? 0) - discount) : 0;
  const submit = async (identity: Omit<CreateAdmissionSessionRequest, "admission" | "operationId">) => {
    if (lock.current || result || !pending && (!preview?.confirmedCreationAvailable || mode === "received" && !confirmed)) return;
    lock.current = true; setBusy(true); setError("");
    const request = pending ?? { ...identity, operationId: crypto.randomUUID(), admission: {
      businessPeriodId: preview!.businessPeriodId, pricingRevision: preview!.pricingRevision, expiresAt: preview!.expiresAt,
      mode, discountAmount: mode === "waived" ? preview!.admissionAmount : discount,
      paymentConfirmed: mode === "received" && confirmed, confirmedReceivedAmount: received, reason: reason.trim() || undefined,
    } };
    setPending(request);
    try {
      const value = await admissionCreationApi.create(request);
      if (!mounted.current) return;
      setPending(null);
      if (value.issued) onIssued(value.issued); else setResult(value.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "開碼結果尚未確認。");
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status)) {
        setPending(null); setConfirmed(false);
      }
    } finally { lock.current = false; setBusy(false); }
  };
  const lookup = async () => {
    if (!pending || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { setResult(await admissionCreationApi.operation(pending.operationId)); setPending(null); }
    catch (e) { setError(e instanceof Error ? e.message : "尚未查到結果，請沿用原操作重試。"); }
    finally { lock.current = false; setBusy(false); }
  };
  const reissue = async () => {
    if (!result || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { const issued = parseIssuedAdmission(await adminApi.reissueOrderSession(result.sessionId)); if (mounted.current) onIssued({ ...issued, admission: result }); }
    catch (e) { setError(e instanceof Error ? e.message : "重發失敗，請至顧客紀錄確認。"); }
    finally { lock.current = false; setBusy(false); }
  };
  return { preview, error, busy, pending, result, locked, mode, setMode, discount, setDiscount, reason, setReason,
    confirmed, setConfirmed, received, load, submit, lookup, reissue };
}
