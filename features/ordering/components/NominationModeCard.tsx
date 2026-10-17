"use client";

import { InlineHelp } from "@/components/InlineHelp";

type Props = {
  kicker: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export function NominationModeCard({ kicker, title, description, selected, onSelect }: Props) {
  return (
    <div className={`nominationModeCard ${selected ? "isActive" : ""}`}>
      <span>{kicker}</span>
      <div className="nominationModeTitle">
        <button type="button" className="nominationModeSelect" aria-pressed={selected} onClick={onSelect}>
          <strong>{title}</strong>
        </button>
        <InlineHelp title={`${title}說明`}>{description}</InlineHelp>
      </div>
    </div>
  );
}
