import { publicClientApiUrl } from "@/lib/server/upstream-config";

export const dynamic = "force-dynamic";

const allowedResources = new Set(["home", "menu"]);

export async function GET(_request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  if (!allowedResources.has(resource)) {
    return Response.json({ success: false, message: "Unknown public resource." }, { status: 404 });
  }

  try {
    const upstream = await fetch(publicClientApiUrl(`/${resource}`), {
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
    return Response.json({ success: false, message: "Unable to refresh public data." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
