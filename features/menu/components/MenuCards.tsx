import type { MenuItem, MenuSet } from "@/features/site/types";

const currency = new Intl.NumberFormat("zh-TW");
const itemRoles: Record<string, string> = {
  main: "主餐", dessert: "甜點", drink: "飲品", other: "其他",
};

export function MenuSerial({ index }: { index: number }) {
  return <span className="menu-card-serial">{String(index + 1).padStart(2, "0")}</span>;
}

export function MenuPrice({ text }: { text: string | null }) {
  if (!text) return null;

  // This splits a display label only; free-form pricing retains its full wording.
  // The API remains the authority for amounts and charging rules.
  const parts = text.match(/^([\d,.]+)\s+(Gil)(?:\s*(\/.*))?$/i);
  return (
    <p className="menu-card-price">
      {parts ? (
        <>
          <strong>{parts[1]}</strong>{" "}<span>{parts[2]}</span>
          {parts[3] && <small>{parts[3]}</small>}
        </>
      ) : <strong>{text}</strong>}
    </p>
  );
}

function MenuArtwork({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  return (
    <div className="menu-card-artwork">
      {imageUrl ? (
        <img src={imageUrl} alt={name} loading="lazy" decoding="async" />
      ) : <span className="menu-card-image-empty">尚無圖片</span>}
    </div>
  );
}

export function MenuItemCard({ item, index }: { item: MenuItem; index: number }) {
  return (
    <li className="menu-product-card">
      <MenuArtwork imageUrl={item.imageUrl} name={item.itemName} />
      <div className="menu-card-content">
        <div className="menu-card-heading">
          <h4>{item.itemName}</h4>
          <MenuSerial index={index} />
        </div>
        {item.itemDescription && <p className="menu-card-description">{item.itemDescription}</p>}
        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <div className="menu-card-tags">
            {item.tags.map((tag) => <small key={tag}>{tag}</small>)}
          </div>
        )}
        <MenuPrice text={currency.format(item.price) + " Gil"} />
      </div>
    </li>
  );
}

export function MenuSetCard({ set, index }: { set: MenuSet; index: number }) {
  return (
    <>
      <MenuArtwork imageUrl={set.imageUrl} name={set.setName} />
      <div className="menu-card-content">
        <div className="menu-card-heading">
          <h3>{set.setName}</h3>
          <MenuSerial index={index} />
        </div>
        {set.setDescription && <p className="menu-card-description">{set.setDescription}</p>}
        <ul className="menu-set-components">
          {set.items.filter((item) => item.isAvailable !== false).map((item) => (
            <li key={item.id}>
              <span>{itemRoles[item.itemRole] || "其他"}</span>
              <b>{item.itemName} × {item.quantity}</b>
            </li>
          ))}
        </ul>
        <MenuPrice text={currency.format(set.setPrice) + " Gil"} />
        {set.isOrderable === false && (
          <p className="menu-set-availability">{set.unavailableReason || "暫停供應"}</p>
        )}
      </div>
    </>
  );
}
