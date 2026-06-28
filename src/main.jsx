import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import {
  events,
  galleryItems,
  guestNotes,
  navigationItems,
  shopInfo,
  staffMembers,
  updates,
} from './mockData.js';

const routeAliases = {
  '/': '/home',
};

const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBasePath(pathname) {
  if (!appBase || appBase === '') return pathname;
  if (pathname === appBase) return '/';
  if (pathname.startsWith(`${appBase}/`)) return pathname.slice(appBase.length);
  return pathname;
}

function normalizePath(pathname) {
  const appPath = stripBasePath(pathname);
  return routeAliases[appPath] || appPath || '/home';
}

function toBrowserPath(route) {
  const normalized = normalizePath(route);
  return `${appBase}${normalized}`;
}

function useRoute() {
  const [route, setRoute] = useState(normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (to) => {
    const normalized = normalizePath(to);
    window.history.pushState({}, '', toBrowserPath(normalized));
    setRoute(normalized);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { route, navigate };
}

function App() {
  const { route, navigate } = useRoute();

  const page = useMemo(() => {
    if (route === '/home') return <HomePage navigate={navigate} />;
    if (route === '/staff') return <StaffPage />;
    if (route === '/event') return <EventPage />;
    if (route === '/gallery') return <GalleryPage />;
    if (route === '/guestbook') return <GuestbookPage />;
    if (route === '/updates') return <UpdatesPage navigate={navigate} />;
    return <NotFoundPage navigate={navigate} />;
  }, [route, navigate]);

  return (
    <PublicLayout route={route} navigate={navigate}>
      {page}
    </PublicLayout>
  );
}

function PublicLayout({ children, route, navigate }) {
  return (
    <div className="appShell">
      <Navbar route={route} navigate={navigate} />
      <main>{children}</main>
      <Footer navigate={navigate} />
    </div>
  );
}

function Navbar({ route, navigate }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (href) => {
    navigate(href);
    setIsOpen(false);
  };

  return (
    <header className="navbar">
      <button className="brandButton" type="button" onClick={() => handleNavigate('/home')}>
        <span className="brandMark">暮</span>
        <span>
          <strong>{shopInfo.name}</strong>
          <small>{shopInfo.shortName}</small>
        </span>
      </button>

      <button
        className="menuButton"
        type="button"
        aria-label="切換導覽選單"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`navLinks ${isOpen ? 'isOpen' : ''}`} aria-label="主要導覽">
        {navigationItems.map((item) => (
          <button
            className={route === item.href ? 'navLink active' : 'navLink'}
            type="button"
            key={item.href}
            onClick={() => handleNavigate(item.href)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function Footer({ navigate }) {
  return (
    <footer className="footer">
      <div>
        <p className="eyebrow">Eorzea Private Salon</p>
        <h2>{shopInfo.name}</h2>
        <p>{shopInfo.footerText}</p>
      </div>
      <div className="footerGrid">
        <FooterColumn title="店舖資訊" items={[shopInfo.server, shopInfo.address, shopInfo.openHours]} />
        <FooterColumn
          title="快速入口"
          items={['店員珍藏', '慶典情報', '店舖動態']}
          onItemClick={(label) => {
            const item = navigationItems.find((nav) => nav.label === label);
            if (item) navigate(item.href);
          }}
        />
        <FooterColumn title="Demo Note" items={['純靜態展示', 'Mock data', '後端 API 預留']} />
      </div>
    </footer>
  );
}

function FooterColumn({ title, items, onItemClick }) {
  return (
    <div className="footerColumn">
      <h3>{title}</h3>
      {items.map((item) =>
        onItemClick ? (
          <button type="button" key={item} onClick={() => onItemClick(item)}>
            {item}
          </button>
        ) : (
          <span key={item}>{item}</span>
        ),
      )}
    </div>
  );
}

function HomePage({ navigate }) {
  const featuredEvent = events.find((event) => event.status === '生效中') || events[0];
  const todayStaff = staffMembers.filter((staff) => staff.todayShift !== '休假').slice(0, 4);

  return (
    <>
      <section className="hero">
        <img className="heroImage" src={shopInfo.heroImage} alt="" loading="eager" />
        <div className="heroContent">
          <p className="eyebrow">FF14 Roleplay Lounge</p>
          <h1>{shopInfo.name}</h1>
          <p className="heroLead">{shopInfo.subtitle}</p>
          <div className="statusLine">
            <StatusBadge tone="success">{shopInfo.businessStatus}</StatusBadge>
            <span>{shopInfo.openHours}</span>
          </div>
          <div className="heroActions">
            <button className="btnPrimary" type="button" onClick={() => navigate('/staff')}>
              查看店員珍藏
            </button>
            <button className="btnSecondary" type="button" onClick={() => navigate('/event')}>
              慶典情報
            </button>
          </div>
        </div>
      </section>

      <section className="section sectionOverlap">
        <div className="infoStrip">
          <InfoBlock label="伺服器" value={shopInfo.server} />
          <InfoBlock label="房區" value={shopInfo.address} />
          <InfoBlock label="入場提示" value={shopInfo.entryNote} />
        </div>
      </section>

      <section className="section twoColumn">
        <DarkCard className="featuredEvent">
          <SectionTitle eyebrow="Tonight" title="今夜主打" />
          <h3>{featuredEvent.title}</h3>
          <p>{featuredEvent.summary}</p>
          <div className="cardMeta">
            <StatusBadge tone={featuredEvent.status === '生效中' ? 'accent' : 'muted'}>
              {featuredEvent.status}
            </StatusBadge>
            <span>{featuredEvent.period}</span>
          </div>
          <button className="textButton" type="button" onClick={() => navigate('/event')}>
            查看完整活動
          </button>
        </DarkCard>

        <DarkCard>
          <SectionTitle eyebrow="Menu" title="消費說明" />
          <div className="priceList">
            {shopInfo.pricing.map((item) => (
              <div className="priceRow" key={item.name}>
                <span>{item.name}</span>
                <strong>{item.price}</strong>
              </div>
            ))}
          </div>
          <p className="softText">{shopInfo.pricingNote}</p>
        </DarkCard>
      </section>

      <section className="section">
        <SectionTitle eyebrow="On Shift" title="今日迎賓店員" />
        <div className="staffRail">
          {todayStaff.map((staff) => (
            <button className="miniStaffCard" type="button" key={staff.id} onClick={() => navigate('/staff')}>
              <img src={staff.avatarUrl} alt={`${staff.nickname} 頭貼`} loading="lazy" />
              <span>{staff.nickname}</span>
              <small>{staff.todayShift}</small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function StaffPage() {
  const [selectedStaff, setSelectedStaff] = useState(null);

  return (
    <PageFrame eyebrow="Staff Collection" title="店員珍藏" intro="翻閱今夜沙龍名冊，選擇想進一步了解的陪伴風格與服務內容。">
      <div className="staffGrid">
        {staffMembers.map((staff) => (
          <StaffCard staff={staff} key={staff.id} onSelect={() => setSelectedStaff(staff)} />
        ))}
      </div>

      <StaffModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
    </PageFrame>
  );
}

function StaffCard({ staff, onSelect }) {
  return (
    <button className="staffCard" type="button" onClick={onSelect}>
      <div className="staffPortrait">
        <img src={staff.avatarUrl} alt={`${staff.nickname} 頭貼`} loading="lazy" />
        <StatusBadge tone={staff.todayShift === '休假' ? 'muted' : 'success'}>{staff.todayShift}</StatusBadge>
      </div>
      <div className="staffCardBody">
        <p className="eyebrow">{staff.role}</p>
        <h2>{staff.nickname}</h2>
        <p>{staff.intro}</p>
        <div className="chipList">
          {staff.commonServices.slice(0, 2).map((service) => (
            <span className="chip" key={service.name}>
              {service.name}
            </span>
          ))}
          {staff.specialServices.slice(0, 1).map((service) => (
            <span className="chip accentChip" key={service.name}>
              {service.name}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function StaffModal({ staff, onClose }) {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [staff]);

  if (!staff) return null;

  const activeImage = staff.gallery[imageIndex];

  return (
    <Modal title={staff.nickname} onClose={onClose}>
      <div className="staffDialog">
        <div className="dialogGallery">
          <img src={activeImage} alt={`${staff.nickname} 形象照片`} />
          <div className="galleryControls" aria-label="店員照片輪播">
            {staff.gallery.map((image, index) => (
              <button
                className={index === imageIndex ? 'dot active' : 'dot'}
                type="button"
                key={image}
                aria-label={`切換至第 ${index + 1} 張照片`}
                onClick={() => setImageIndex(index)}
              />
            ))}
          </div>
        </div>
        <div className="dialogContent">
          <p className="eyebrow">{staff.role}</p>
          <h2>{staff.nickname}</h2>
          <StatusBadge tone={staff.todayShift === '休假' ? 'muted' : 'success'}>
            {staff.todayShift}
          </StatusBadge>
          <p>{staff.detail}</p>
          <ServiceTable title="共通服務" services={staff.commonServices} />
          <ServiceTable title="個人特殊服務" services={staff.specialServices} />
        </div>
      </div>
    </Modal>
  );
}

function ServiceTable({ title, services }) {
  return (
    <div className="serviceTable">
      <h3>{title}</h3>
      {services.map((service) => (
        <div className="serviceRow" key={service.name}>
          <span>{service.name}</span>
          <strong>{service.price}</strong>
        </div>
      ))}
    </div>
  );
}

function EventPage() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const visibleEvents = events
    .filter((event) => !event.hiddenByAge)
    .sort((a, b) => Number(b.status === '生效中') - Number(a.status === '生效中'));

  return (
    <PageFrame eyebrow="Festival Briefing" title="慶典情報" intro="所有近期可參與的沙龍企劃都收在此處，生效中的活動會優先排列。">
      <div className="eventList">
        {visibleEvents.map((event) => (
          <button className="eventCard" type="button" key={event.id} onClick={() => setSelectedEvent(event)}>
            <img src={event.imageUrl} alt="" loading="lazy" />
            <div>
              <div className="cardMeta">
                <StatusBadge tone={event.status === '生效中' ? 'accent' : 'muted'}>{event.status}</StatusBadge>
                <span>{event.period}</span>
              </div>
              <h2>{event.title}</h2>
              <p>{event.summary}</p>
            </div>
          </button>
        ))}
      </div>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </PageFrame>
  );
}

function EventModal({ event, onClose }) {
  if (!event) return null;

  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="eventDialog">
        {event.imageUrl ? <img src={event.imageUrl} alt={`${event.title} 活動照片`} /> : null}
        <div>
          <div className="cardMeta">
            <StatusBadge tone={event.status === '生效中' ? 'accent' : 'muted'}>{event.status}</StatusBadge>
            <span>{event.period}</span>
          </div>
          <h2>{event.title}</h2>
          {event.details.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function GalleryPage() {
  return (
    <PageFrame eyebrow="Eorzea Weekly" title="艾歐澤亞週報" intro="第一版先保留活動花絮版型，後續可接上照片審核與分類資料。">
      <div className="galleryGrid">
        {galleryItems.map((item) => (
          <DarkCard className="galleryCard" key={item.title}>
            <img src={item.imageUrl} alt={item.title} loading="lazy" />
            <StatusBadge tone="muted">{item.category}</StatusBadge>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </DarkCard>
        ))}
      </div>
    </PageFrame>
  );
}

function GuestbookPage() {
  return (
    <PageFrame eyebrow="Guestbook" title="留聲機" intro="留言板在第一版先以展示資料呈現，未來可接後端審核與公開留言 API。">
      <div className="noteList">
        {guestNotes.map((note) => (
          <DarkCard key={note.name}>
            <div className="cardMeta">
              <StatusBadge tone="muted">{note.badge}</StatusBadge>
              <span>{note.date}</span>
            </div>
            <h2>{note.name}</h2>
            <p>{note.message}</p>
          </DarkCard>
        ))}
      </div>
    </PageFrame>
  );
}

function UpdatesPage({ navigate }) {
  return (
    <PageFrame eyebrow="Salon Board" title="店舖動態" intro="整合近期公告、班表摘要與入場提醒，第一版先提供靜態瀏覽入口。">
      <div className="updatesGrid">
        {updates.map((update) => (
          <DarkCard key={update.title}>
            <StatusBadge tone={update.tone}>{update.type}</StatusBadge>
            <h2>{update.title}</h2>
            <p>{update.description}</p>
            {update.action ? (
              <button className="textButton" type="button" onClick={() => navigate(update.action.href)}>
                {update.action.label}
              </button>
            ) : null}
          </DarkCard>
        ))}
      </div>
    </PageFrame>
  );
}

function NotFoundPage({ navigate }) {
  return (
    <PageFrame eyebrow="404" title="迷路的傳送門" intro="這個頁面尚未開放，請回到沙龍大廳。">
      <button className="btnPrimary" type="button" onClick={() => navigate('/home')}>
        回首頁
      </button>
    </PageFrame>
  );
}

function PageFrame({ eyebrow, title, intro, children }) {
  return (
    <section className="pageFrame">
      <div className="pageHeader">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {children}
    </section>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div className="sectionTitle">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

function DarkCard({ className = '', children }) {
  return <article className={`darkCard ${className}`}>{children}</article>;
}

function StatusBadge({ tone = 'accent', children }) {
  return <span className={`statusBadge ${tone}`}>{children}</span>;
}

function InfoBlock({ label, value }) {
  return (
    <div className="infoBlock">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.classList.add('modalOpen');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('modalOpen');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modalPanel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="closeButton" type="button" aria-label="關閉視窗" onClick={onClose}>
          ×
        </button>
        {children}
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
