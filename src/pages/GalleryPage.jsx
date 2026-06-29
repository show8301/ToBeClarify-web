import { DarkCard } from '../components/DarkCard.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { galleryItems } from '../mockData.js';

export function GalleryPage() {
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
