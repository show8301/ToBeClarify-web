import { navigationItems, shopInfo } from '../mockData.js';

export function Footer({ navigate }) {
  const footerMainLinks = navigationItems.filter((item) => !item.children);
  const footerRankingLinks =
    navigationItems.find((item) => item.label === '榮譽殿堂')?.children || [];

  return (
    <footer className="footer">
      <div>
        <p className="eyebrow">Eorzea Private Salon</p>
        <h2>{shopInfo.name}</h2>
        <p>{shopInfo.footerText}</p>
      </div>
      <div className="footerGrid">
        <FooterColumn title="店舖資訊" items={[shopInfo.server, shopInfo.address, shopInfo.openHours]} />
        <FooterColumn title="主要導覽" items={footerMainLinks} onItemClick={(item) => navigate(item.href)} />
        <FooterColumn title="榮譽殿堂" items={footerRankingLinks} onItemClick={(item) => navigate(item.href)} />
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
          <button type="button" key={item.href} onClick={() => onItemClick(item)}>
            {item.label}
          </button>
        ) : (
          <span key={item}>{item}</span>
        ),
      )}
    </div>
  );
}
