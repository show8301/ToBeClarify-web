"use client";

import { InlineHelp } from "@/components/InlineHelp";

type Props = { kicker: string; title: string; text?: string };

export function OrderPageHeading({ kicker, title, text }: Props) {
  return (
    <header className="orderPageHeading">
      <span>{kicker}</span>
      <div className="orderPageTitle">
        <h1>{title}</h1>
        {text ? <InlineHelp title={`${title}說明`}>{text}</InlineHelp> : null}
      </div>
    </header>
  );
}
