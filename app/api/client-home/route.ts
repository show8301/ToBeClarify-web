const API_HOME = "https://api.marchgroup.net/api/client/home";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(API_HOME, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ success: false, message: "Unable to refresh homepage data." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
