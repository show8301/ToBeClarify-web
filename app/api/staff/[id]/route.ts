const API = "https://api.marchgroup.net/api/client/staff-members";
export async function GET(_request:Request, context:{ params:Promise<{id:string}> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error:"Invalid staff id" }, { status:400 });
  const response = await fetch(`${API}/${id}`, { headers:{ Accept:"application/json" } });
  if (!response.ok) return Response.json({ error:"Staff not found" }, { status:response.status });
  const payload = await response.json() as { data:unknown };
  return Response.json(payload.data, { headers:{ "Cache-Control":"public, max-age=60" } });
}
