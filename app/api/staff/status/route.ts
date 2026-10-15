import { getStaffDutyStatuses } from "@/features/staff/server/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    return Response.json(await getStaffDutyStatuses(), { headers });
  } catch {
    return Response.json({ error: "Unable to refresh staff duty status" }, { status: 502, headers });
  }
}
