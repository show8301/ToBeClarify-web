import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PageFrame } from '../components/PageFrame.jsx';
import { menuSections } from '../mockData.js';

export function MenuPage() {
  const [activeSectionId, setActiveSectionId] = useState(menuSections[0]?.id);
  const activeSection = useMemo(
    () => menuSections.find((section) => section.id === activeSectionId) ?? menuSections[0],
    [activeSectionId],
  );

  return (
    <PageFrame eyebrow="Salon Menu" title="佳餚名錄" intro="以分類切換瀏覽店內餐點，正式版可改由後台維護價格與圖片。">
      <section className="menuPanel">
        <div className="menuCategoryBar" aria-label="餐點分類">
          {menuSections.map((section) => (
            <button
              className={section.id === activeSection.id ? 'menuCategory active' : 'menuCategory'}
              type="button"
              key={section.id}
              onClick={() => setActiveSectionId(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="menuSection"
            key={activeSection.id}
            initial={{ opacity: 0, y: 14, scale: 0.985, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, scale: 0.99, filter: 'blur(8px)' }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="menuSectionHeader">
              <p className="eyebrow">Category</p>
              <h2>{activeSection.label}</h2>
              <p>{activeSection.intro}</p>
            </div>

            <div className="menuItemGrid">
              {activeSection.items.map((item) => (
                <article className="menuItemCard" key={item.id}>
                  <img src={item.imageUrl} alt="" loading="lazy" />
                  <div className="menuItemBody">
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                    </div>
                    <strong>{item.price}</strong>
                  </div>
                </article>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>
    </PageFrame>
  );
}
