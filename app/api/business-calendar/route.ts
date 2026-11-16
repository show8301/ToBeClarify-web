import { publicClientApiUrl } from "@/lib/server/upstream-config";
import { parseBusinessCalendar } from "@/features/live-update/calendar";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month");
  const headers = { "Cache-Control": "no-store" };
  if (month !== null && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1900 || Number(month.slice(0, 4)) > 9998)) {
    return Response.json({ error: "月份格式無效。" }, { status: 400, headers });
  }
  const upstream = new URL(publicClientApiUrl("/business-calendar"));
  if (month) upstream.searchParams.set("month", month);
  try {
    const response = await fetch(upstream, {
      cache: "no-store", headers: { Accept: "application/json" },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
    });
    if (!response.ok) return Response.json({ error: "無法讀取營業行事曆。" }, { status: response.status, headers });
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload)) throw new Error("Invalid calendar payload");
    return Response.json(parseBusinessCalendar(payload.data), { headers });
  } catch {
    return Response.json({ error: "營業行事曆暫時無法使用。" }, { status: 502, headers });
  }
}
