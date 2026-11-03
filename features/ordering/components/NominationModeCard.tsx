"use client";

import { useId } from "react";

type Props = {
  value: string;
  title: string;
  description: string;
  price: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
};

export function NominationModeCard({ value, title, description, price, detail, selected, onSelect }: Props) {
  const id = useId();
  return (
    <label htmlFor={id} aria-label={title} className={`nominationModeCard ${selected ? "isActive" : ""}`}>
      <input id={id} type="radio" name="nomination-mode" value={value} checked={selected} onChange={onSelect} />
      <span className="nominationModeCopy">
        <span className="nominationModeHeading"><strong>{title}</strong>{selected ? <span>已選擇</span> : null}</span>
        <span>{description}</span>
        <b>{price}</b>
        <small>{detail}</small>
      </span>
    </label>
  );
}
