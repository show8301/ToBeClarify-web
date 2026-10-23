import type { KeyboardEvent } from "react";
import { BadgeCheck, Receipt, SlidersHorizontal, UserRound } from "lucide-react";
import type { SettlementTab } from "./types";

type Props = {
  active: SettlementTab;
  canManage: boolean;
  disabled?: boolean;
  onChange: (tab: SettlementTab) => void;
};

const tabs = [
  { id: "operations", label: "營運結算", Icon: Receipt },
  { id: "personal", label: "個人帳目", Icon: UserRound },
  { id: "dispatch", label: "薪資派發", Icon: BadgeCheck },
  { id: "settings", label: "結算設定", Icon: SlidersHorizontal },
] as const;

export function SettlementTabs({ active, canManage, disabled = false, onChange }: Props) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (disabled || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const enabled = tabs.filter((tab) => !["settings", "dispatch"].includes(tab.id) || canManage);
    const current = enabled.findIndex((tab) => tab.id === active);
    const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length;
    event.preventDefault();
    onChange(enabled[next].id);
    event.currentTarget.querySelector<HTMLButtonElement>(`#settlement-tab-${enabled[next].id}`)?.focus();
  };

  return (
    <div className="adminSettlementTabs" role="tablist" aria-label="結算工作分類" tabIndex={-1} onKeyDown={onKeyDown}>
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          id={`settlement-tab-${id}`}
          type="button"
          role="tab"
          aria-selected={active === id}
          aria-controls={`settlement-panel-${id}`}
          tabIndex={active === id ? 0 : -1}
          disabled={disabled || (["settings", "dispatch"].includes(id) && !canManage)}
          onClick={() => onChange(id)}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
