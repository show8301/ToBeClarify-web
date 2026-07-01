import { useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { galleryItems } from '../mockData.js';

const today = new Date('2026-07-01T00:00:00+08:00');
const oneMonthAgo = new Date('2026-06-01T00:00:00+08:00');

function isOlderThanOneMonth(item) {
  return new Date(`${item.endAt}T23:59:59+08:00`) < oneMonthAgo;
}

export function GalleryPage() {
  const [selectedGallery, setSelectedGallery] = useState(null);
  const visibleItems = galleryItems
    .filter((item) => !isOlderThanOneMonth(item))
    .sort((a, b) => Number(new Date(`${b.endAt}T23:59:59+08:00`) >= today) - Number(new Date(`${a.endAt}T23:59:59+08:00`) >= today));

  return (
    <PageFrame eyebrow="Eorzea Weekly" title="艾歐澤亞週報" intro="以活動縮圖與短述收錄店內花絮，點開後可查看完整照片拼貼。">
      <div className="galleryList">
        {visibleItems.map((item, index) => (
          <button
            className={`galleryFeatureCard ${index % 2 === 1 ? 'isReverse' : ''}`}
            type="button"
            key={item.id}
            onClick={() => setSelectedGallery(item)}
          >
            <img src={item.imageUrl} alt="" loading="lazy" />
            <div>
              <span>{item.period}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </div>
          </button>
        ))}
      </div>

      <GalleryModal item={selectedGallery} onClose={() => setSelectedGallery(null)} />
    </PageFrame>
  );
}

function GalleryModal({ item, onClose }) {
  if (!item) return null;

  return (
    <Modal title={item.title} onClose={onClose}>
      <div className="galleryDialog">
        <div className="galleryDialogHeader">
          <p className="eyebrow">Photo Collage</p>
          <h2>{item.title}</h2>
          <span>{item.period}</span>
          {item.details.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="photoCollage">
          {item.photos.slice(0, 20).map((photo, index) => (
            <img src={photo} alt={`${item.title} 活動照片 ${index + 1}`} key={photo} loading="lazy" />
          ))}
        </div>
      </div>
    </Modal>
  );
}
