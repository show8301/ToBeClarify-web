import { getPublicMediaBaseUrl } from "@/lib/server/upstream-config";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) {
    return Response.json({ success: false, message: "無效的媒體識別碼。" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${getPublicMediaBaseUrl()}/${encodeURIComponent(id)}?variant=original`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      return Response.json({ success: false, message: "無法取得原始頭像。" }, { status: upstream.status });
    }
    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      },
    });
  } catch {
    return Response.json({ success: false, message: "原始頭像暫時無法讀取。" }, { status: 502 });
  }
}
