"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";

type NavigationItem = readonly [string, string];
type Props = {
  items: NavigationItem[];
  current: string;
  cartCount: number;
  onNavigate: (key: string) => void;
};

const groups = [
  { label: "點餐與服務", keys: ["meal", "nomination", "tip", "room"] },
  { label: "我的點餐", keys: ["cart", "orders"] },
  { label: "需要協助", keys: ["help"] },
];

export function OrderNavigation({ items, current, cartCount, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1101px)");
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  const navigate = (key: string) => {
    onNavigate(key);
    setOpen(false);
  };
  const list = () => <nav className="orderCustomerNav" aria-label="點餐功能">
    {groups.map(group => <section key={group.label}>
      <h2>{group.label}</h2>
      {items.filter(([key]) => group.keys.includes(key)).map(([key, label]) => <button
        key={key} type="button" aria-current={current === key ? "page" : undefined}
        className={current === key ? "isActive" : ""} onClick={() => navigate(key)}
      >
        <span>{label}</span>
        {key === "cart" && cartCount > 0 ? <span className="orderNavCount" aria-label={`${cartCount} 項`}>{cartCount}</span> : null}
      </button>)}
    </section>)}
  </nav>;

  return <>
    <aside className="orderNavigationDesktop" aria-label="顧客導覽">{list()}</aside>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="orderNavigationMobile">
        <Dialog.Trigger className="orderMenuTrigger">選單</Dialog.Trigger>
        <strong>{items.find(([key]) => key === current)?.[1]}</strong>
        <button type="button" aria-current={current === "cart" ? "page" : undefined} onClick={() => navigate("cart")}>
          購物車{cartCount > 0 ? `（${cartCount}）` : ""}
        </button>
      </div>
      <Dialog.Portal>
        <Dialog.Backdrop className="orderMenuBackdrop" />
        <Dialog.Popup className="orderMenuDrawer">
          <header><Dialog.Title>點餐選單</Dialog.Title><Dialog.Close aria-label="關閉點餐選單">關閉</Dialog.Close></header>
          {list()}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
