import { navigationItems, shopInfo } from '../mockData.js';

export function Footer({ navigate }) {
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
