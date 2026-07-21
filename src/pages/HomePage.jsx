import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminEasterEgg } from '../components/AdminEasterEgg.jsx';
import { DarkCard } from '../components/DarkCard.jsx';
import { EventModal } from '../components/EventModal.jsx';
import { ImageWithLoading } from '../components/ImageWithLoading.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApiData } from '../data/ApiDataContext.jsx';

export function HomePage({ navigate }) {
  const { carouselEvents, shopInfo, shopRules } = useApiData();
  const visibleCarouselEvents = useMemo(
    () => carouselEvents.filter((event) => event.status !== '已失效'),
    [carouselEvents],
  );
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [eventDirection, setEventDirection] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const activeEvent = visibleCarouselEvents[activeEventIndex];
  const hasMultipleEvents = visibleCarouselEvents.length > 1;

  const moveEvent = (direction) => {
    setEventDirection(direction);
    setActiveEventIndex((currentIndex) => {
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0) return visibleCarouselEvents.length - 1;
      if (nextIndex >= visibleCarouselEvents.length) return 0;
      return nextIndex;
    });
  };

  const jumpToEvent = (nextIndex) => {
    if (nextIndex === activeEventIndex) return;
    setEventDirection(nextIndex > activeEventIndex ? 1 : -1);
    setActiveEventIndex(nextIndex);
  };

  return (
    <>
      <section className="hero">
        <ImageWithLoading className="heroImage" src={shopInfo.heroImage} alt="" loading="eager" fetchPriority="high" />
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
            <button className="btnSecondary" type="button" onClick={() => navigate('/menu')}>
              佳餚名錄
            </button>
          </div>
        </div>
        <AdminEasterEgg onActivate={() => navigate('/admin/login')} />
      </section>

      <section className="section sectionOverlap">
        <DarkCard className="aboutCard">
          <SectionTitle eyebrow="About Us" title="關於35女王古殿" />
          <div className="aboutText">
            {shopInfo.about.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </DarkCard>
      </section>

      <section className="section">
        <DarkCard className="eventCarouselCard">
          <div className="eventCarouselHeader">
            <SectionTitle eyebrow="Festival Briefing" title="慶典情報" />
            {hasMultipleEvents ? (
              <div className="carouselControls" aria-label="活動輪播控制">
                <button type="button" onClick={() => moveEvent(-1)} aria-label="上一個活動">
                  ←
                </button>
                <button type="button" onClick={() => moveEvent(1)} aria-label="下一個活動">
                  →
                </button>
              </div>
            ) : null}
          </div>

          {activeEvent ? <div className="eventCarouselViewport">
            <AnimatePresence mode="wait" custom={eventDirection}>
              <motion.div
                className="eventCarouselBody"
                key={activeEvent.id}
                custom={eventDirection}
                initial={(direction) => ({
                  opacity: 0,
                  x: direction > 0 ? 72 : -72,
                  rotateY: direction > 0 ? -18 : 18,
                  scale: 0.96,
                })}
                animate={{
                  opacity: 1,
                  x: 0,
                  rotateY: 0,
                  scale: 1,
                }}
                exit={(direction) => ({
                  opacity: 0,
                  x: direction > 0 ? -72 : 72,
                  rotateY: direction > 0 ? 18 : -18,
                  scale: 0.96,
                })}
                transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
              >
                <ImageWithLoading src={activeEvent.imageUrl} alt="" />
                <div>
                  <div className="cardMeta">
                    <span>{activeEvent.period}</span>
                  </div>
                  <h3>{activeEvent.title}</h3>
                  <p>{activeEvent.summary}</p>
                  <button className="textButton" type="button" onClick={() => setSelectedEvent(activeEvent)}>
                    查看完整活動
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div> : <p className="softText">目前沒有公開活動。</p>}

          {hasMultipleEvents ? (
            <div className="carouselDots" aria-label="活動輪播頁碼">
              {visibleCarouselEvents.map((event, index) => (
                <button
                  className={index === activeEventIndex ? 'active' : ''}
                  type="button"
                  key={event.id}
                  onClick={() => jumpToEvent(index)}
                  aria-label={`切換到 ${event.title}`}
                />
              ))}
            </div>
          ) : null}
        </DarkCard>
      </section>

      <section className="section">
        <DarkCard className="rulesCard">
          <SectionTitle eyebrow="House Rules" title="店內規則" />
          <div className="rulesList">
            {shopRules.map((rule, index) => (
              <div className="ruleItem" key={`${index}-${rule}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{rule}</p>
              </div>
            ))}
          </div>
        </DarkCard>
      </section>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </>
  );
}
