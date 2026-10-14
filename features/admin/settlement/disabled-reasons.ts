import type { SettlementWorkflow } from "./types";

type FinalizeState = {
  canManage: boolean;
  saving: boolean;
  dirty: boolean;
  finalized: boolean;
  anomalyCount: number;
  workflow?: SettlementWorkflow | null;
};

export function getFinalizeDisabledReason(state: FinalizeState): string | undefined {
  if (!state.canManage) return "只有店經理或開發人員可以正式結算。";
  if (state.saving) return "正在處理操作，請稍候再確認正式結算。";
  if (state.dirty) return "有尚未保存的輸入，請返回金額核對，保存後再確認正式結算。";
  if (state.finalized) return "本時段已完成正式結算。";
  if (state.anomalyCount > 0) return `尚有 ${state.anomalyCount} 項結算異常，請返回金額核對處理。`;
  if (state.workflow?.canFinalize === false) {
    switch (state.workflow.periodStatus) {
      case "scheduled":
        return "本營業日尚未開店，請先完成開店及關店流程。";
      case "open":
      case "coordination":
        return "請先停止新單並完成關店，再確認正式結算。";
      case "settled":
        return "本營業日已結算，請確認是否需要重新開放新的營業時段。";
      default:
        return "系統尚未允許正式結算，請重新整理營業狀態後確認。";
    }
  }
  return undefined;
}
