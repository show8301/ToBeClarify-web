"use client";

import { useId, useMemo, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, X } from "lucide-react";
import { AdminField } from "@/features/admin/shared/AdminShared.jsx";
import type { OperationsSession } from "./operationsTypes";

type Props = {
  sessions: OperationsSession[];
  periodId: string;
  selectedId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
};
type EntryScope = "all" | "open" | "departed" | "unknown";
type PeriodScope = "all" | "current" | "carry";
type GuestOption = { id: string; label: string; entry: Exclude<EntryScope, "all">; period: Exclude<PeriodScope, "all"> | "unknown" };

function entryState(session: OperationsSession): GuestOption["entry"] {
  if (session.entryStatus === "departed" || session.status === "readonly") return "departed";
  if (session.status === "active" && session.entryStatus === "open") return "open";
  return "unknown";
}

const entryLabels = { open: "在場", departed: "已離店／唯讀", unknown: "入場狀態待確認" };

export function ServiceGuestPicker({ sessions, periodId, selectedId, disabled, onSelect }: Props) {
  const pickerId = useId();
  const countId = useId();
  const [entryScope, setEntryScope] = useState<EntryScope>("all");
  const [periodScope, setPeriodScope] = useState<PeriodScope>("all");
  const options = useMemo<GuestOption[]>(() => sessions.map((session) => {
    const entry = entryState(session);
    const period = !periodId || !session.businessPeriodId ? "unknown" : session.businessPeriodId === periodId ? "current" : "carry";
    const periodLabel = period === "current" ? "本期" : period === "carry" ? `跨期 ${session.businessDate || ""}`.trim() : "營業期待確認";
    return { id: session.id, entry, period, label: `${session.customerName} · ${session.gameId} · ${entryLabels[entry]} · ${periodLabel}` };
  }), [sessions, periodId]);
  const candidates = options.filter((item) => (entryScope === "all" || item.entry === entryScope) && (periodScope === "all" || item.period === periodScope));
  const selected = options.find((item) => item.id === selectedId) || null;
  const selectedOutsideScope = selected && !candidates.some((item) => item.id === selected.id);

  return <>
    <div className="serviceGuestFilters">
      <div className="serviceGuestPickerField">
        <label htmlFor={pickerId}>顧客搜尋</label>
        <Combobox.Root<GuestOption>
          items={candidates}
          value={selected}
          disabled={disabled}
          autoHighlight
          itemToStringLabel={(item) => item.label}
          itemToStringValue={(item) => item.id}
          isItemEqualToValue={(item, value) => item.id === value.id}
          filter={(item, query) => item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())}
          onValueChange={(item) => onSelect(item?.id || "")}
        >
          <Combobox.InputGroup className="serviceGuestPicker">
            <Combobox.Input id={pickerId} placeholder="輸入顧客名稱或遊戲 ID…" aria-describedby={countId} />
            <Combobox.Clear aria-label="清除選取顧客"><X size={16} aria-hidden="true" /></Combobox.Clear>
            <Combobox.Trigger aria-label="顯示顧客選單"><ChevronDown size={16} aria-hidden="true" /></Combobox.Trigger>
          </Combobox.InputGroup>
          <Combobox.Portal className="adminTheme serviceGuestPickerPortal">
            <Combobox.Positioner sideOffset={6} align="start" className="serviceGuestPickerPositioner">
              <Combobox.Popup className="serviceGuestPickerPopup">
                <Combobox.Empty className="serviceGuestPickerEmpty">沒有符合的顧客，可清除關鍵字或調整篩選。</Combobox.Empty>
                <Combobox.List>{(item: GuestOption) => <Combobox.Item key={item.id} value={item} className="serviceGuestPickerItem">{item.label}</Combobox.Item>}</Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
      <AdminField label="入場狀態"><select disabled={disabled} value={entryScope} onChange={(event) => {
        const value = event.target.value;
        if (value === "all" || value === "open" || value === "departed" || value === "unknown") setEntryScope(value);
      }}><option value="all">全部</option><option value="open">在場</option><option value="departed">已離店／唯讀</option><option value="unknown">狀態待確認</option></select></AdminField>
      <AdminField label="營業期範圍"><select disabled={disabled} value={periodScope} onChange={(event) => {
        const value = event.target.value;
        if (value === "all" || value === "current" || value === "carry") setPeriodScope(value);
      }}><option value="all">全部（含跨期履約）</option><option value="current">本期入場</option><option value="carry">跨期履約顧客</option></select></AdminField>
    </div>
    <p id={countId} className="serviceGuestCount" role="status">篩選範圍共 {candidates.length} 位顧客{selectedOutsideScope ? "；目前選取的顧客不在此範圍，明細仍保留。" : "。"}</p>
  </>;
}
