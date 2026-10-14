"use client";

import { useState } from "react";
import type { MenuData, MenuSetItem } from "@/features/site/types";

type Staff = { id: string; displayName: string };
type MealLine = {
  referenceId: string;
  kind: "item" | "set";
  name: string;
  price: number;
  quantity: number;
  isChampagneTower?: boolean;
  recipientStaffId?: string | null;
  recipientStaffName?: string | null;
};
type Cart = { meals: MealLine[] };
type Product = {
  id: string; kind: "item" | "set"; name: string; description: string; price: number;
  imageUrl?: string | null; tags?: string[]; items?: MenuSetItem[];
  isOrderable?: boolean; isChampagneTower: boolean;
};
type Props = {
  menu: MenuData; staff: Staff[]; cart: Cart;
  setCart: (update: (current: Cart) => Cart) => void;
};

export function MealOrderPage({ menu, staff, setCart }: Props) {
  const sets = menu.sets.filter(set => set.items.some(item => item.isAvailable !== false));
  const showSets = sets.length > 0 && (menu.contractVersion === 2 || menu.showSets !== false);
  const [category, setCategory] = useState(menu.categories[0]?.id || (showSets ? "sets" : ""));
  const [recipients, setRecipients] = useState<Record<string, string>>({});
  const supportsRecipients = menu.champagnePolicyVersion === 1;
  const products: Product[] = category === "sets"
    ? sets.map(item => ({ ...item, kind: "set", name: item.setName, description: item.setDescription,
        price: item.setPrice, isChampagneTower: (item.effectiveEventCategories || []).includes("champagne_tower") }))
    : (menu.categories.find(item => item.id === category)?.items || []).map(item => ({ ...item, kind: "item",
        name: item.itemName, description: item.itemDescription, isChampagneTower: (item.policy?.eventCategories || []).includes("champagne_tower") }));

  const add = (product: Product) => {
    const recipientId = product.isChampagneTower && supportsRecipients ? recipients[`${product.kind}:${product.id}`] || null : null;
    const recipient = staff.find(person => person.id === recipientId);
    setCart(current => {
      const found = current.meals.find(line => line.referenceId === product.id && line.kind === product.kind
        && (line.recipientStaffId || null) === recipientId);
      const meals = found ? current.meals.map(line => line === found ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line)
        : [...current.meals, { referenceId: product.id, kind: product.kind, name: product.name, price: product.price,
            quantity: 1, isChampagneTower: product.isChampagneTower && supportsRecipients,
            recipientStaffId: recipientId, recipientStaffName: recipient?.displayName || null }];
      return { ...current, meals };
    });
  };

  return <div className="orderPage">
    <header className="orderPageHeading"><span>FOOD &amp; DRINK</span><h1>一般點餐</h1><p>信物餘額保留供後續加點。{supportsRecipients ? "香檳塔及含香檳塔的套餐不可使用信物折抵；可贈送給店家或指定店員。" : "實際折抵以正式報價為準。"}</p></header>
    <div className="orderCategoryRail">
      {showSets && <button type="button" className={category === "sets" ? "isActive" : ""} onClick={() => setCategory("sets")}>套餐</button>}
      {menu.categories.map(item => <button type="button" className={category === item.id ? "isActive" : ""} key={item.id} onClick={() => setCategory(item.id)}>{item.categoryName}</button>)}
    </div>
    <div className="orderProductGrid">{products.map(item => {
      const key = `${item.kind}:${item.id}`;
      return <article key={key} className="orderProductCard">
        <div className="orderProductImage">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>LD</span>}</div>
        <div>{item.kind === "set" && <small>SET</small>}<h2>{item.name}</h2><p>{item.description || "現場供應品項"}</p>
          {item.items && <ul>{item.items.map(part => <li key={part.id}>{part.itemName} × {part.quantity}{part.isAvailable === false ? " · 暫停供應" : ""}</li>)}</ul>}
          {item.tags && <p>{item.tags.join(" · ")}</p>}
          {item.isChampagneTower && supportsRecipients && <label className="tipStaffSelect">香檳塔贈送對象
            <select value={recipients[key] || ""} onChange={event => setRecipients(current => ({ ...current, [key]: event.target.value }))}>
              <option value="">不指定店員，送給店家</option>
              {staff.map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}
            </select><small>不可使用信物折抵；贈送不會建立陪伴指名或占用服務時段。</small>
          </label>}
        </div>
        <footer><strong>{item.price.toLocaleString("zh-TW")} G</strong><button type="button" disabled={item.isOrderable === false}
          aria-label={`加入 ${item.name}`} onClick={() => add(item)}><span aria-hidden="true">＋</span>{item.isOrderable === false ? " 暫停供應" : ""}</button></footer>
      </article>;
    })}</div>
  </div>;
}
