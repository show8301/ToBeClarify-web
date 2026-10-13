"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { HomePageVisibility, MenuData } from "@/features/site/types";
import { MenuItemCard, MenuPrice, MenuSerial, MenuSetCard } from "./MenuCards";

const isInternalCopy = (value: string) => /(demo|mock|測試|api\s*(提供|維護)|後台.*維護)/i.test(value);
type MenuCatalogProps = { menu: MenuData; roomsVisible?: boolean };

export default function MenuCatalog({ menu: initialMenu, roomsVisible = true }: MenuCatalogProps) {
  const [menu, setMenu] = useState(initialMenu);
  const [menuStatus, setMenuStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, retry] = useState(0);
  const [category, setCategory] = useState(initialMenu.categories[0]?.id ?? "");
  const [roomVisibility, setRoomVisibility] = useState<{ source: boolean; visible: boolean } | null>(null);
  const reduceMotion = useReducedMotion();
  const active = menu.categories.find((item) => item.id === category) ?? menu.categories[0];
  const showRoomEntry = roomVisibility?.source === roomsVisible ? roomVisibility.visible : roomsVisible;
  const pricingRules = menu.pricingRules.filter((rule) => rule.policy?.showOnMenu !== false);
  const visibleSets = menu.showSets === false ? [] : menu.sets.filter(
    (set) => set.items.some((item) => item.isAvailable !== false),
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/menu", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = await response.json() as { success: boolean; data: MenuData };
        if (!payload.success) throw new Error();
        if (!controller.signal.aborted) {
          setMenu(payload.data);
          setMenuStatus("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setMenuStatus("error");
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/home", { cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: unknown) => {
        const data = payload as { success?: boolean; data?: { pageVisibility?: Partial<HomePageVisibility> } } | null;
        if (data?.success && typeof data.data?.pageVisibility?.rooms === "boolean") {
          setRoomVisibility({ source: roomsVisible, visible: data.data.pageVisibility.rooms });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [roomsVisible]);

  return (
    <div className="menu-page">
      {menuStatus !== "ready" && (
        <p className="menu-update-state" role="status">
          {menuStatus === "loading" ? "正在更新菜單，以下內容供參考。" : "菜單更新失敗，以下價格可能已變更，請洽店員確認。"}
          {menuStatus === "error" && (
            <button type="button" onClick={() => { setMenuStatus("loading"); retry((value) => value + 1); }}>重新載入</button>
          )}
        </p>
      )}
      {menuStatus === "ready" && menu.updatedAt && (
        <p className="menu-update-state">資料取得時間：{new Date(menu.updatedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</p>
      )}

      <section className="menu-hero">
        <div><span>THE TASTE OF A WAKING DREAM</span><h1>NIGHT<br /><i>MENU</i></h1></div>
        <div className="menu-cover-card">
          <span>清醒夢 · LUCID DREAM</span><b>佳餚名錄</b>
          <p>在每一場夜談之間，留一點溫度給餐桌。飲品、甜點與套餐，為今晚的相遇添上一筆餘韻。</p>
          <i>EDITION / 2026</i>
        </div>
      </section>

      {pricingRules.length > 0 && (
        <section className="menu-pricing-rules" aria-labelledby="menu-pricing-title">
          <header className="menu-section-heading">
            <div><span className="menu-section-kicker">HOUSE CHARGE</span><h2 id="menu-pricing-title" className="menu-section-title">入夢須知</h2></div>
          </header>
          <div className="menu-fee-grid">
            {pricingRules.map((rule, index) => (
              <article key={rule.id} className="menu-fee-card">
                <div className="menu-card-heading"><h3>{rule.title}</h3><MenuSerial index={index} /></div>
                <MenuPrice text={rule.priceText} />
                {rule.description && !isInternalCopy(rule.description) && (
                  <p className="menu-card-description">{rule.description}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {visibleSets.length > 0 && (
        <section className="menu-sets" aria-labelledby="menu-sets-title">
          <header className="menu-section-heading">
            <div><span className="menu-section-kicker">CURATED SETS</span><h2 id="menu-sets-title" className="menu-section-title">今夜套餐</h2></div>
          </header>
          <div className="menu-set-grid">
            {visibleSets.map((set, index) => (
              <motion.article key={set.id} className="menu-set-card"
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
                transition={{ delay: Math.min(index, 4) * 0.05 }}>
                <MenuSetCard set={set} index={index} />
              </motion.article>
            ))}
          </div>
        </section>
      )}

      <section className="menu-catalog" aria-labelledby="menu-catalog-title">
        <header className="menu-section-heading">
          <div><span className="menu-section-kicker">À LA CARTE</span><h2 id="menu-catalog-title" className="menu-section-title">單點選集</h2></div>
          {menu.categories.length > 0 && (
            <nav className="menu-category-tabs" aria-label="菜單分類">
              {menu.categories.map((item) => (
                <button key={item.id} type="button" className={item.id === active?.id ? "active" : ""}
                  aria-pressed={item.id === active?.id} aria-controls="menu-category-panel"
                  onClick={() => setCategory(item.id)}>
                  <span>{item.categoryName}</span><i>{String(item.items.length).padStart(2, "0")}</i>
                </button>
              ))}
            </nav>
          )}
        </header>
        <AnimatePresence mode="wait">
          {active ? (
            <motion.div key={active.id} id="menu-category-panel" className="menu-category-panel"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}>
              <h3 className="menu-category-title">{active.categoryName}</h3>
              {active.items.length > 0 ? (
                <ol className="menu-product-grid">
                  {active.items.map((item, index) => <MenuItemCard key={item.id} item={item} index={index} />)}
                </ol>
              ) : <p className="menu-catalog-empty">此分類目前沒有供應品項。</p>}
            </motion.div>
          ) : <p key="empty" className="menu-catalog-empty">目前沒有供應品項。</p>}
        </AnimatePresence>
      </section>

      {showRoomEntry && (
        <section className="menu-room-entry">
          <div><span>PRIVATE ROOMS</span><h2>今晚想把哪一段相遇，留在包廂裡？</h2><p>查看店內共用與店員專屬包廂的照片、每節價格與使用說明。</p></div>
          <a href="/menu/rooms">進入包廂介紹 <i>↗</i></a>
        </section>
      )}
    </div>
  );
}
