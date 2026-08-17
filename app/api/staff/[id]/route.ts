import { getStaffDetail } from "../../../staff-data";

export async function GET(_request:Request, context:{ params:Promise<{id:string}> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error:"Invalid staff id" }, { status:400 });
  const staff = getStaffDetail(id);
  if (!staff) return Response.json({ error:"Staff not found" }, { status:404 });
  return Response.json(staff, { headers:{ "Cache-Control":"public, max-age=600, stale-while-revalidate=86400" } });
}
