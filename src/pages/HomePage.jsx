import { DarkCard } from '../components/DarkCard.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { events, shopInfo, shopRules } from '../mockData.js';

export function HomePage({ navigate }) {
  const featuredEvent = events.find((event) => event.status === '生效中') || events[0];

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
        <DarkCard className="aboutCard">
          <SectionTitle eyebrow="About Us" title="關於暮光沙龍" />
          <div className="aboutText">
            {shopInfo.about.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </DarkCard>
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
        <DarkCard className="rulesCard">
          <SectionTitle eyebrow="House Rules" title="店內規則" />
          <div className="rulesList">
            {shopRules.map((rule, index) => (
              <div className="ruleItem" key={rule}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{rule}</p>
              </div>
            ))}
          </div>
        </DarkCard>
      </section>
    </>
  );
}
