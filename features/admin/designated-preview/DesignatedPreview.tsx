"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Bell, Clock3, Moon, Sun, RotateCcw } from "lucide-react";
import { AdminButton, AdminPage, AdminToggle } from "@/features/admin/shared/AdminShared.jsx";
import PreviewActionDialog from "./PreviewActionDialog";
import { CurrentService, GuestDesk, GuestList, NextService, RequestsPanel, SchedulePanel } from "./PreviewPanels";
import { createSampleGuests, VARIANTS } from "./preview-data";
import type { ActionRequest, PreviewVariant, ServiceStatus } from "./preview-data";

const NAV_GROUPS = [
  { name: "營運", items: [["01", "營業工作台"], ["02", "訂單查詢"], ["03", "包廂服務排程"], ["04", "通知中心"]] },
  { name: "營運管理", items: [["11", "營運總覽"], ["12", "值班規劃"], ["14", "帳目／薪資結算"]] },
  { name: "顧客與互動", items: [["21", "歷史顧客"], ["22", "繪圖／簽繪交付"], ["23", "留言板管理"]] },
  { name: "公開網站內容", items: [["31", "首頁設定"], ["32", "店員資料設定"]] },
];

export default function DesignatedPreview({ initialVariant }: { initialVariant: PreviewVariant }) {
  const [variant, setVariant] = useState(initialVariant);
  const [guests, setGuests] = useState(createSampleGuests);
  const [selectedId, setSelectedId] = useState("moon");
  const [action, setAction] = useState<ActionRequest | null>(null);
  const [accepting, setAccepting] = useState(true);
  const [clockedIn, setClockedIn] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const selected = guests.find((guest) => guest.id === selectedId) || guests[0];
  const dialogGuest = guests.find((guest) => guest.id === action?.guestId);
  const pending = guests.filter((guest) => guest.status === "awaiting").length;
  const completed = guests.filter((guest) => guest.status === "completed").length;
  const variantInfo = VARIANTS.find((item) => item.id === variant) || VARIANTS[0];

  useEffect(() => {
    const previous = document.documentElement.dataset.adminTheme;
    // Apply after the shared provider initializes the stored theme; previews do not save preferences.
    const timer = window.setTimeout(() => { document.documentElement.dataset.adminTheme = isDark ? "dark" : "light"; }, 0);
    return () => {
      window.clearTimeout(timer);
      if (previous === undefined) delete document.documentElement.dataset.adminTheme;
      else document.documentElement.dataset.adminTheme = previous;
    };
  }, [isDark]);

  const chooseVariant = (next: PreviewVariant) => {
    setVariant(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  };

  const selectGuest = (id: string) => {
    setSelectedId(id);
    if (variant !== "customers" || window.innerWidth < 1100) {
      document.getElementById("dp-customer-desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const changeStatus = (id: string, status: ServiceStatus) => {
    const guest = guests.find((item) => item.id === id);
    if (!guest || (status === "in_service" && guests.some((item) => item.status === "in_service"))) return;
    setGuests((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    setFeedback(`已模擬${status === "confirmed" ? "確認承接" : status === "completed" ? "完成服務" : "開始服務"}：${guest.name}。`);
  };

  const changeDeparture = (id: string) => {
    const guest = guests.find((item) => item.id === id);
    if (!guest || (!guest.departed && guest.status === "in_service")) return;
    setGuests((items) => items.map((item) => item.id === id ? { ...item, departed: !item.departed } : item));
    setFeedback(`已模擬${guest.departed ? "重新開放點餐" : "標記離店並關閉點餐"}：${guest.name}。`);
  };

  const reset = () => {
    setGuests(createSampleGuests());
    setSelectedId("moon");
    setAction(null);
    setAccepting(true);
    setClockedIn(true);
    setFeedback("");
    setShowNotifications(false);
  };

  const panels = {
    guests,
    selected,
    onSelect: selectGuest,
    onAction: setAction,
    onStatus: changeStatus,
    onDeparture: changeDeparture,
  };

  return (
    <main className={`adminShell adminDesignatedPreview dpVariant-${variant}`}>
      <header className={`adminTopbar ${isMenuOpen ? "isMenuOpen" : ""}`}>
        <div className="adminTopbarScroll">
          <div className="adminTopbarBrand">
            <span className="adminTopbarMark">
              <Image src="/favicon.ico" alt="" width={44} height={44} unoptimized />
            </span>
            <span className="adminTopbarBrandCopy">
              <strong>清醒夢</strong><small>LUCID DREAM</small>
            </span>
            <button
              className="adminBackToSite adminBrandSiteLink"
              type="button"
              onClick={() => setFeedback("設計稿保留原有側欄；營業操作可直接在工作台完成。")}
            >
              ↗ 公開網站
            </button>
          </div>
          <button
            className="adminMenuButton"
            type="button"
            aria-label="切換後台導覽選單"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span /><span /><span />
          </button>
          <nav className={`adminNav ${isMenuOpen ? "isOpen" : ""}`} aria-label="後台功能選單（設計稿）">
            {NAV_GROUPS.map((group) => (
              <section className="adminNavGroup" key={group.name}>
                <p className="adminNavLabel">{group.name}</p>
                {group.items.map(([index, label]) => (
                  <button
                    type="button"
                    key={index}
                    className={index === "01" ? "isActive" : ""}
                    aria-current={index === "01" ? "page" : undefined}
                    onClick={() => {
                      setFeedback(`「${label}」保留在原側欄。這份設計稿的營業功能可直接在工作台操作。`);
                      setIsMenuOpen(false);
                    }}
                  >
                    <span className="adminNavIndex">{index}</span>
                    <span className="adminNavText">{label}</span>
                  </button>
                ))}
              </section>
            ))}
          </nav>
          <div className="adminTopbarUtilities">
            <div className="adminAccount">
              <div className="adminAccountIdentity">
                <small>目前登入</small><strong>菲萊</strong><span>指名人員</span>
              </div>
              <AdminButton
                variant="ghost"
                className="iconActionButton"
                aria-label={isDark ? "切換淺色主題" : "切換深色主題"}
                onClick={() => setIsDark(!isDark)}
              >
                {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              </AdminButton>
            </div>
          </div>
        </div>
      </header>
      <div className="adminWorkspace"><div className="adminContent">
        <AdminPage
          eyebrow="DESIGN PREVIEW · 指名人員 DASHBOARD"
          title="指名人員工作台"
          description="菲萊，先回覆指名，再處理服務與顧客的現場需求。"
          actions={<>
            <AdminButton variant="ghost" aria-expanded={showNotifications} onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={16} aria-hidden="true" />通知 {pending}
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => setIsDark(!isDark)}>
              {isDark ? "淺色預覽" : "深色預覽"}
            </AdminButton>
          </>}
        >
          <div className="dpStack">
            <section className="dpPreviewBar" aria-label="設計稿比較">
              <div>
                <span className="dpPreviewLabel">設計稿 {variantInfo.number} · 範例資料</span>
                <p>{variantInfo.description}</p>
              </div>
              <div className="dpVersionSelector" aria-label="選擇設計稿">
                {VARIANTS.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={variant === item.id}
                    className={variant === item.id ? "isSelected" : ""}
                    onClick={() => chooseVariant(item.id)}
                  >
                    <span>{item.number}</span>{item.name}
                  </button>
                ))}
              </div>
              <AdminButton variant="ghost" className="iconActionButton" aria-label="重設範例資料" onClick={reset}>
                <RotateCcw aria-hidden="true" />
              </AdminButton>
            </section>
            {feedback && (
              <div className="dpFeedback" role="status">
                <span>設計預覽 · {feedback}</span>
                <AdminButton variant="ghost" onClick={() => setFeedback("")}>收起</AdminButton>
              </div>
            )}
            {showNotifications && (
              <section className="dpNotifications">
                <strong>營業通知</strong>
                {guests.filter((guest) => guest.status === "awaiting").map((guest) => (
                  <button
                    type="button"
                    key={guest.id}
                    onClick={() => { setShowNotifications(false); selectGuest(guest.id); }}
                  >
                    {guest.name} · {guest.source} · {guest.start}–{guest.end}
                    <span>查看並回覆 →</span>
                  </button>
                ))}
                {pending === 0 && <p>目前沒有待回覆指名。</p>}
              </section>
            )}
            <section className="dpShiftBar" aria-label="我的營業狀態">
              <div className="dpShiftIdentity">
                <span className={`dpLiveDot ${clockedIn ? "" : "isOff"}`} aria-hidden="true" />
                <div>
                  <strong>{clockedIn ? "上班中" : "已下班"}<small>10/10 · 22:00–01:00</small></strong>
                  <span>今晚 5 筆指名 · 已完成 {completed} 筆</span>
                </div>
              </div>
              <div className="dpShiftClock"><Clock3 size={16} aria-hidden="true" /><span>範例時間 22:24</span></div>
              <AdminToggle
                checked={accepting && clockedIn}
                disabled={!clockedIn}
                ariaLabel="接收新指名"
                onChange={(checked: boolean) => {
                  setAccepting(checked);
                  setFeedback(`已模擬${checked ? "恢復" : "暫停"}接收新指名。`);
                }}
                label={accepting && clockedIn ? "接收新指名" : "暫停新指名"}
              />
              <AdminButton
                variant="ghost"
                onClick={() => {
                  setClockedIn(!clockedIn);
                  setFeedback(`已模擬${clockedIn ? "下班" : "上班"}打卡。`);
                }}
              >
                {clockedIn ? "下班打卡" : "上班打卡"}
              </AdminButton>
            </section>
            {variant === "tasks" && <>
              <div className="dpTaskGrid">
                <RequestsPanel {...panels} />
                <div className="dpStack">
                  <CurrentService {...panels} />
                  <NextService guests={guests} onSelect={selectGuest} />
                </div>
              </div>
              <div className="dpTaskGrid">
                <div id="dp-customer-desk"><GuestDesk {...panels} /></div>
                <SchedulePanel guests={guests} onSelect={selectGuest} />
              </div>
            </>}
            {variant === "customers" && <>
              <div className="dpCustomerGrid">
                <GuestList {...panels} />
                <div id="dp-customer-desk"><GuestDesk {...panels} /></div>
              </div>
              <SchedulePanel guests={guests} onSelect={selectGuest} expanded />
            </>}
            {variant === "service" && <>
              <div className="dpServiceGrid">
                <div className="dpStack">
                  <CurrentService {...panels} focus />
                  <NextService guests={guests} onSelect={selectGuest} />
                </div>
                <SchedulePanel guests={guests} onSelect={selectGuest} />
              </div>
              <div className="dpTaskGrid">
                <RequestsPanel {...panels} />
                <div id="dp-customer-desk"><GuestDesk {...panels} /></div>
              </div>
            </>}
            <p className="dpFootnote">設計預覽使用範例資料；操作僅更新本頁。營業流程直接在工作台完成。</p>
          </div>
        </AdminPage>
      </div></div>
      {action && dialogGuest && (
        <PreviewActionDialog
          key={`${action.action}-${dialogGuest.id}`}
          action={action.action}
          guest={dialogGuest}
          onClose={() => setAction(null)}
          onComplete={(message, declined) => {
            setFeedback(message);
            if (declined) {
              setGuests((items) => items.map((item) => item.id === dialogGuest.id ? { ...item, status: "manager" } : item));
            }
          }}
        />
      )}
    </main>
  );
}
