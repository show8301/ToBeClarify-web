export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      deploymentSha: process.env.DEPLOYMENT_SHA?.trim() || "local",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
