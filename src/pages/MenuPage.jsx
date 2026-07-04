import { motion } from 'framer-motion';
import { PageFrame } from '../components/PageFrame.jsx';
import { menuSections, shopInfo } from '../mockData.js';

export function MenuPage() {
  return (
    <PageFrame eyebrow="Salon Menu" title="佳餚名錄" intro="先確認消費規則，再瀏覽本週提供的餐點與套餐。">
      <section className="menuPanel">
        <motion.div
          className="menuSectionsStack"
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        >
          <section className="menuSection">
            <div className="menuSectionDivider" aria-hidden="true" />
            <div className="menuSectionHeader">
              <h2>消費規則</h2>
              <p>入席前請先確認基本收費與預約方式，正式營運前價格可再由後台或 API 維護。</p>
            </div>

            <div className="menuPricingGrid">
              {shopInfo.pricing.map((item) => (
                <div className="priceRow" key={item.name}>
                  <span>{item.name}</span>
                  <strong>{item.price}</strong>
                </div>
              ))}
            </div>
            <p className="softText">{shopInfo.pricingNote}</p>
          </section>

          {menuSections.map((section) => (
            <section className="menuSection" key={section.id}>
              <div className="menuSectionDivider" aria-hidden="true" />
              <div className="menuSectionHeader">
                <h2>{section.label}</h2>
                <p>{section.intro}</p>
              </div>

              <div className="menuItemGrid">
                {section.items.map((item) => (
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
            </section>
          ))}
        </motion.div>
      </section>
    </PageFrame>
  );
}
