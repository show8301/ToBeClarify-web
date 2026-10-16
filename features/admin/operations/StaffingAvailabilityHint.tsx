import { AdminHelp } from "@/features/admin/shared/AdminHelp";

export function StaffingAvailabilityHint({ reason }: { reason: string }) {
  return <AdminHelp title="臨時排班輸入說明">{reason}</AdminHelp>;
}
