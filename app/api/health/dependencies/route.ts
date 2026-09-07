import { publicClientApiUrl } from "@/lib/server/upstream-config";

export const dynamic = "force-dynamic";

// Bounded, read-only readiness checks; /api/health remains the process liveness probe.
export async function GET() {
  const checks = await Promise.all([
    ["publicApi", "/home"],
    ["reservations", "/staff-reservations"],
  ].map(async ([name, path]) => {
    try {
      const response = await fetch(publicClientApiUrl(path), {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3500),
      });
      const payload: unknown = await response.json();
      const healthy = response.ok && typeof payload === "object" && payload !== null
        && "success" in payload && payload.success === true;
      return { name, healthy, status: response.status };
    } catch {
      return { name, healthy: false, status: null };
    }
  }));
  const healthy = checks.every(check => check.healthy);
  return Response.json({ status: healthy ? "ok" : "degraded", checks }, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
