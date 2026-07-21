import { useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { ApiState } from '../components/ApiState.jsx';
import { ImageWithLoading } from '../components/ImageWithLoading.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { adaptGalleryAlbum } from '../api/adapters.js';
import { clientApi } from '../api/client.js';
import { useApiResource } from '../data/useApiResource.js';

export function GalleryPage() {
  const [selectedGallery, setSelectedGallery] = useState(null);
  const resource = useApiResource(async (signal) => {
    const albums = await clientApi.getGalleryAlbums(signal);
    const details = await Promise.all(albums.map((album) => clientApi.getGalleryAlbum(album.id, signal)));
    return details.map(adaptGalleryAlbum);
  }, []);
  const visibleItems = resource.data || [];

  return (
    <PageFrame eyebrow="Eorzea Weekly" title="艾歐澤亞週報" intro="以活動縮圖與短述收錄店內花絮，點開後可查看完整照片拼貼。">
      <ApiState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
        <div className="galleryList">
          {visibleItems.map((item, index) => (
          <button
            className={`galleryFeatureCard ${index % 2 === 1 ? 'isReverse' : ''}`}
            type="button"
            key={item.id}
            onClick={() => setSelectedGallery(item)}
          >
            <ImageWithLoading src={item.imageUrl} alt="" />
            <div>
              <span>{item.period}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </div>
          </button>
          ))}
        </div>
      </ApiState>

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
            <ImageWithLoading
              src={photo.thumbnailUrl}
              alt={`${item.title} 活動照片 ${index + 1}`}
              key={`${photo.imageUrl}-${index}`}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
