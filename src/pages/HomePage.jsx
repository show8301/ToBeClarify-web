import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { adaptGalleryAlbum } from '../api/adapters.js';
import { clientApi } from '../api/client.js';
import { AdminEasterEgg } from '../components/AdminEasterEgg.jsx';
import { DarkCard } from '../components/DarkCard.jsx';
import { ImageWithLoading } from '../components/ImageWithLoading.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApiData } from '../data/ApiDataContext.jsx';
import buttonLeft from '../assets/button1.png';
import buttonRight from '../assets/button2.png';
import { GalleryModal } from './GalleryPage.jsx';

export function HomePage({ navigate }) {
  const { carouselReports, homeSlides, shopInfo, shopRules } = useApiData();
  const visibleCarouselEvents = useMemo(
    () => carouselReports,
    [carouselReports],
  );
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [eventDirection, setEventDirection] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetailLoading, setEventDetailLoading] = useState(false);
  const [eventDetailError, setEventDetailError] = useState(null);
  const eventDetailRequestRef = useRef(null);
  const activeEvent = visibleCarouselEvents[activeEventIndex];
  const hasMultipleEvents = visibleCarouselEvents.length > 1;
  const slideshowImages = useMemo(
    () => homeSlides.length ? homeSlides : (shopInfo.heroImage ? [{ id: 'legacy-hero', imageUrl: shopInfo.heroImage }] : []),
    [homeSlides, shopInfo.heroImage],
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState({});
  const shouldReduceMotion = useReducedMotion();
  const activeSlide = slideshowImages[activeSlideIndex];

  useEffect(() => {
    setActiveSlideIndex(0);
    setLoadedSlides({});
  }, [homeSlides, shopInfo.heroImage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loadedIds = slideshowImages
        .filter((slide) => {
          const image = document.querySelector(`.heroSlide[data-slide-id="${slide.id}"]`);
          return image?.complete && image.naturalWidth > 0;
        })
        .map((slide) => slide.id);
      if (loadedIds.length) setLoadedSlides((current) => ({ ...current, ...Object.fromEntries(loadedIds.map((id) => [id, true])) }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [slideshowImages]);

  useEffect(() => {
    if (shouldReduceMotion || slideshowImages.length < 2) return undefined;
    const displaySeconds = Math.min(60, Math.max(1, Number(activeSlide?.displaySeconds) || 10));
    const timer = window.setTimeout(() => {
      setActiveSlideIndex((currentIndex) => (currentIndex + 1) % slideshowImages.length);
    }, displaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [activeSlide?.displaySeconds, shouldReduceMotion, slideshowImages.length, activeSlideIndex]);

  const markSlideLoaded = (id) => setLoadedSlides((current) => ({ ...current, [id]: true }));

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

  useEffect(() => {
    return () => eventDetailRequestRef.current?.abort();
  }, []);

  const openEvent = async (event) => {
    eventDetailRequestRef.current?.abort();
    setSelectedEvent(event);
    setEventDetailError(null);

    if (!event.albumId) {
      setEventDetailLoading(false);
      return;
    }

    const controller = new AbortController();
    eventDetailRequestRef.current = controller;
    setEventDetailLoading(true);
    try {
      setSelectedEvent(adaptGalleryAlbum(await clientApi.getGalleryAlbum(event.albumId, controller.signal)));
    } catch (error) {
      if (error.name !== 'AbortError') setEventDetailError(error);
    } finally {
      if (eventDetailRequestRef.current === controller) {
        eventDetailRequestRef.current = null;
        setEventDetailLoading(false);
      }
    }
  };

  const closeEvent = () => {
    eventDetailRequestRef.current?.abort();
    eventDetailRequestRef.current = null;
    setSelectedEvent(null);
    setEventDetailLoading(false);
    setEventDetailError(null);
  };

  return (
    <>
      <section className="hero">
        <div className="heroSlideshow" aria-hidden="true">
          {slideshowImages.map((slide, index) => (
            <img
              className={`heroSlide ${index === activeSlideIndex ? 'isActive' : ''} ${loadedSlides[slide.id] ? 'isLoaded' : ''}`.trim()}
              data-slide-id={slide.id}
              key={slide.id}
              src={slide.imageUrl}
              alt=""
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
              onLoad={() => markSlideLoaded(slide.id)}
            />
          ))}
        </div>
        <div className="heroContent">
          <h1>{shopInfo.name}</h1>
          <p className="heroLead">{shopInfo.subtitle}</p>
          <div className="statusLine">
            <StatusBadge tone="success">{shopInfo.businessStatus}</StatusBadge>
            <span>{shopInfo.openHours}</span>
          </div>
          <div className="heroActions">
            <button className="homeCta homeCtaLeft" type="button" onClick={() => navigate('/staff')}>
              <img className="homeCtaArt" src={buttonLeft} alt="" aria-hidden="true" />
              <span>查看店員珍藏</span>
            </button>
            <button className="homeCta homeCtaRight" type="button" onClick={() => navigate('/menu')}>
              <img className="homeCtaArt" src={buttonRight} alt="" aria-hidden="true" />
              <span>佳餚名錄</span>
            </button>
          </div>
        </div>
        <AdminEasterEgg onActivate={() => navigate('/admin/login')} />
      </section>

      <section className="section sectionOverlap">
        <DarkCard className="aboutCard">
          <SectionTitle eyebrow="About Us" title="關於清醒夢" />
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
                  <button className="textButton" type="button" onClick={() => openEvent(activeEvent)}>
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

      <GalleryModal item={selectedEvent} loading={eventDetailLoading} error={eventDetailError} onClose={closeEvent} />
    </>
  );
}
