import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { ImageWithLoading } from './ImageWithLoading.jsx';

export function StaffDetailModal({ staff, onClose }) {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [staff]);

  if (!staff) return null;

  const gallery = Array.isArray(staff.gallery) ? staff.gallery.filter(Boolean) : [];
  const activeImage = gallery[imageIndex] || staff.avatarUrl;

  return (
    <Modal title={staff.nickname} onClose={onClose}>
      <div className="staffDialog">
        <div className="dialogGallery">
          <ImageWithLoading src={activeImage} alt={`${staff.nickname} 形象照片`} loading="eager" />
          {gallery.length > 1 ? (
            <div className="galleryControls" aria-label="店員照片輪播">
              {gallery.map((image, index) => (
                <button
                  className={index === imageIndex ? 'dot active' : 'dot'}
                  type="button"
                  key={`${image}-${index}`}
                  aria-label={`切換至第 ${index + 1} 張照片`}
                  aria-current={index === imageIndex ? 'true' : undefined}
                  onClick={() => setImageIndex(index)}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="dialogContent">
          <p className="eyebrow">{staff.role}</p>
          <h2>{staff.nickname}</h2>
          <p>{staff.detail}</p>
          <ServiceTable title="共通服務" services={staff.commonServices} />
          <ServiceTable title="個人特殊服務" services={staff.specialServices} />
        </div>
      </div>
    </Modal>
  );
}

function ServiceTable({ title, services }) {
  return (
    <div className="serviceTable">
      <h3>{title}</h3>
      {services.map((service) => (
        <div className="serviceRow" key={service.name}>
          <span>
            {service.name}
            {service.description ? <small>{service.description}</small> : null}
          </span>
          <strong>{service.price}</strong>
        </div>
      ))}
    </div>
  );
}
