"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type Service = { id:string; serviceName:string; serviceDescription:string; priceText:string|null };
export type GalleryImage = { id:string; imageUrl:string };
export type StaffSummary = {
  id:string; displayName:string; nickname:string|null; avatarUrl:string|null; roleTitle:string|null;
  shortBio:string; isWorkingToday:boolean; currentStatus:string; statusText:string;
  commonServices:Service[]; specialServices:Service[];
};
export type StaffDetail = StaffSummary & { profileBio:string|null; gallery:GalleryImage[] };

const fallbackPortrait = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'%3E%3Crect width='100%25' height='100%25' fill='%23d9d2c5'/%3E%3Ccircle cx='400' cy='390' r='150' fill='%23eee9df'/%3E%3Cpath d='M150 950c30-240 150-350 250-350s220 110 250 350' fill='%23eee9df'/%3E%3C/svg%3E";
function monogram(name:string) { return name.replace(/[·・\s/]/g, "").slice(0, 3).toUpperCase(); }

export default function StaffArchive({ initialStaff, initialDetail }:{ initialStaff:StaffSummary[]; initialDetail:StaffDetail }) {
  const [selected, setSelected] = useState(initialDetail);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number|null>(null);
  const reduceMotion = useReducedMotion();
  const filtered = useMemo(() => initialStaff.filter((person) => `${person.displayName}${person.nickname ?? ""}${person.roleTitle ?? ""}`.toLowerCase().includes(query.toLowerCase())), [initialStaff, query]);

  const chooseStaff = useCallback(async (person:StaffSummary) => {
    if (person.id === selected.id || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/staff/${person.id}`);
      if (!response.ok) throw new Error("fetch failed");
      setSelected(await response.json() as StaffDetail);
    } finally { setLoading(false); }
  }, [loading, selected.id]);

  const gallery = selected.gallery ?? [];
  const lightboxImages = gallery.length ? gallery : selected.avatarUrl ? [{ id:"avatar", imageUrl:selected.avatarUrl.replace("variant=card", "variant=full") }] : [];
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const stepLightbox = useCallback((step:number) => setLightboxIndex((current) => current === null ? null : (current + step + lightboxImages.length) % lightboxImages.length), [lightboxImages.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (event:KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowRight") stepLightbox(1);
      if (event.key === "ArrowLeft") stepLightbox(-1);
    };
    document.body.classList.add("modal-open"); window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("modal-open"); window.removeEventListener("keydown", onKey); };
  }, [closeLightbox, lightboxIndex, stepLightbox]);

  const services = [...(selected.commonServices ?? []), ...(selected.specialServices ?? [])];
  return (
    <main className="archive-shell">
      <header className="archive-header">
        <a className="archive-brand" href="#stage" aria-label="March Group 首頁">MARCH <i>GROUP</i></a>
        <span className="archive-edition">WAKING DREAM · STAFF ARCHIVE</span>
        <div className="header-count"><b>{String(initialStaff.length).padStart(2,"0")}</b><span>MEMBERS<br/>ON FILE</span></div>
      </header>

      <aside className="roster" aria-label="店員名單">
        <div className="roster-top"><span>SELECT A PROFILE</span><label><span className="sr-only">搜尋店員</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋名字 / 職稱" /><b>⌕</b></label></div>
        <div className="roster-list">
          {filtered.map((person, index) => (
            <motion.button layout key={person.id} className={`roster-person ${person.id === selected.id ? "active" : ""}`} onClick={() => chooseStaff(person)} aria-pressed={person.id === selected.id}>
              <span className="roster-no">{String(index + 1).padStart(2,"0")}</span><span className="roster-avatar"><img src={person.avatarUrl || fallbackPortrait} alt="" /></span>
              <span className="roster-copy"><b>{person.displayName}</b><small>{person.roleTitle || "DREAM STAFF"}</small></span><i className={person.isWorkingToday ? "online" : ""} />
            </motion.button>
          ))}
        </div>
      </aside>

      <section className="profile-stage" id="stage" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.article key={selected.id} className="profile-spread" initial={reduceMotion ? { opacity:0 } : { opacity:0, x:34, rotate:.4 }} animate={{ opacity:1, x:0, rotate:0 }} exit={reduceMotion ? { opacity:0 } : { opacity:0, x:-28 }} transition={{ duration:.42, ease:[.22,1,.36,1] }}>
            <div className="poster-word" aria-hidden="true">{monogram(selected.displayName)}</div><div className="profile-label">PERSONNEL FILE <b>/ {selected.id.slice(0,4).toUpperCase()}</b></div>
            <div className="portrait-zone">
              <motion.button className="main-polaroid" whileHover={reduceMotion ? undefined : { rotate:-1.2, y:-5 }} onClick={() => lightboxImages.length && setLightboxIndex(0)} aria-label="放大查看店員照片">
                <span className="clip">Ⅱ</span><span className="main-photo"><img src={selected.avatarUrl || fallbackPortrait} alt={`${selected.displayName} 店員照片`} /></span><span className="photo-caption"><b>{selected.displayName}</b><i>PORTRAIT / 01</i></span>
              </motion.button>
              <div className="status-stamp"><i /><b>{selected.statusText || "今日待命"}</b><small>TODAY&apos;S STATUS</small></div><p className="side-note">MEET THE DREAMERS · MARCH GROUP</p>
            </div>

            <div className="dossier">
              <div className="dossier-head"><div><span>DISPLAY NAME</span><h1>{selected.displayName}</h1></div><b className="file-number">{String(initialStaff.findIndex(s => s.id === selected.id) + 1).padStart(2,"0")}</b></div>
              <div className="role-row"><span>{selected.roleTitle || "DREAM STAFF"}</span>{selected.nickname && <i>AKA. {selected.nickname}</i>}</div>
              <div className="dossier-scroll">
                <section className="bio-block"><header><b>人物誌</b><span>PROFILE NOTE</span></header><p>{selected.profileBio || selected.shortBio || "這位夢境成員正在準備自己的介紹。"}</p></section>
                {services.length > 0 && <section className="service-block"><header><b>服務項目</b><span>{services.length} SERVICES</span></header><div className="service-grid">
                  {services.map((service, index) => <article key={service.id}><span>{String(index + 1).padStart(2,"0")}</span><div><h3>{service.serviceName}</h3><p>{service.serviceDescription}</p></div>{service.priceText && <b>{service.priceText}</b>}</article>)}
                </div></section>}
                <section className="gallery-block"><header><b>影像紀錄</b><button onClick={() => lightboxImages.length && setLightboxIndex(0)} disabled={!lightboxImages.length}>OPEN LIGHTBOX ↗</button></header><div className="filmstrip">
                  {lightboxImages.slice(0,5).map((image, index) => <motion.button whileHover={reduceMotion ? undefined : { y:-6, rotate:index % 2 ? 1.5 : -1.5 }} key={image.id} onClick={() => setLightboxIndex(index)} aria-label={`查看第 ${index + 1} 張照片`}><img src={image.imageUrl} alt="" /><span>0{index+1}</span></motion.button>)}
                </div></section>
              </div>
              <div className="dossier-foot"><span>RECORD ID · {selected.id.slice(0,13)}</span><b>KEEP DREAMING ✦</b></div>
            </div>
          </motion.article>
        </AnimatePresence>
        {loading && <div className="loading-layer"><span>LOADING FILE</span></div>}
      </section>

      <AnimatePresence>{lightboxIndex !== null && lightboxImages[lightboxIndex] && <motion.div className="lightbox" role="dialog" aria-modal="true" aria-label={`${selected.displayName} 照片瀏覽器`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={(e) => e.target === e.currentTarget && closeLightbox()}>
        <div className="lightbox-top"><div><span>PHOTO ARCHIVE</span><b>{selected.displayName}</b></div><button onClick={closeLightbox} aria-label="關閉照片瀏覽器">CLOSE <i>×</i></button></div>
        <button className="lightbox-arrow prev" onClick={() => stepLightbox(-1)} aria-label="上一張">←</button>
        <motion.figure key={lightboxImages[lightboxIndex].id} drag="x" dragConstraints={{left:0,right:0}} dragElastic={.7} onDragEnd={(_, info) => Math.abs(info.offset.x) > 70 && stepLightbox(info.offset.x < 0 ? 1 : -1)} initial={reduceMotion ? {opacity:0}:{opacity:0,scale:.92,rotate:lightboxIndex%2?1.5:-1.5}} animate={{opacity:1,scale:1,rotate:0}} exit={{opacity:0,scale:.96}} transition={{duration:.32}}>
          <img src={lightboxImages[lightboxIndex].imageUrl} alt={`${selected.displayName} 的第 ${lightboxIndex + 1} 張照片`} /><figcaption><span>MARCH GROUP / VISUAL RECORD</span><b>{String(lightboxIndex + 1).padStart(2,"0")} — {String(lightboxImages.length).padStart(2,"0")}</b></figcaption>
        </motion.figure><button className="lightbox-arrow next" onClick={() => stepLightbox(1)} aria-label="下一張">→</button>
        <div className="lightbox-thumbs">{lightboxImages.map((image,index) => <button key={image.id} className={index===lightboxIndex?"active":""} onClick={() => setLightboxIndex(index)} aria-label={`前往第 ${index+1} 張`}><img src={image.imageUrl} alt="" /></button>)}</div>
      </motion.div>}</AnimatePresence>
    </main>
  );
}
