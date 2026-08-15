import StaffArchive, { type StaffDetail, type StaffSummary } from "./StaffArchive";

const API = "https://api.marchgroup.net/api/client";
const FEATURED_ID = "f5f3b15a-9768-4e37-87e5-abcbc4e9cf0d";

async function getData() {
  const [listResponse, detailResponse] = await Promise.all([
    fetch(`${API}/staff-members`, { next: { revalidate: 60 } }),
    fetch(`${API}/staff-members/${FEATURED_ID}`, { next: { revalidate: 60 } }),
  ]);
  if (!listResponse.ok || !detailResponse.ok) throw new Error("無法取得店員資料");
  const listJson = await listResponse.json() as { data: StaffSummary[] };
  const detailJson = await detailResponse.json() as { data: StaffDetail };
  return { staff: listJson.data, featured: detailJson.data };
}

export default async function Home() {
  const { staff, featured } = await getData();
  return <StaffArchive initialStaff={staff} initialDetail={featured} />;
}
