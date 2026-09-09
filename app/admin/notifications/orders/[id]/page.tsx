import {AdminNotificationOrderRoute} from '@/features/admin/shell/AdminRoutes.jsx';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return <AdminNotificationOrderRoute orderId={id}/>;
}
