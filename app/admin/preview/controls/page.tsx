import { AdminButtonPreview } from "@/features/admin/shared/AdminButtonPreview";
import { getFinalizeDisabledReason } from "@/features/admin/settlement/disabled-reasons";

export default function AdminControlsPreviewPage() {
  const reason = getFinalizeDisabledReason({ canManage: true, saving: false, dirty: true, finalized: false, anomalyCount: 0 });
  return <AdminButtonPreview finalizeReason={reason || "請先完成結算前置條件。"} />;
}
