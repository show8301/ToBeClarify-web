import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { ImageWithLoading } from './ImageWithLoading.jsx';
import { getStaffCardChipIcon, staffCardOrbit } from './StaffCardDecorations.jsx';

export function StaffDetailModal({ staff, onClose }) {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [staff]);

  if (!staff) return null;

  const gallery = Array.isArray(staff.gallery) ? staff.gallery.filter(Boolean) : [];
  const activeImage = gallery[imageIndex] || staff.avatarUrl;

  return (
    <Modal title={staff.displayName || staff.nickname} onClose={onClose} panelClassName="staffDetailModalPanel">
      <div className="staffDialog">
        <div className="dialogGallery">
          <ImageWithLoading src={activeImage} alt={`${staff.displayName || staff.nickname} 形象照片`} loading="eager" />
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
          {staff.role ? <div className="staffDialogRole"><span aria-hidden="true">✦</span><span>{staff.role}</span><span aria-hidden="true">✦</span></div> : null}
          <div className="staffDialogNameWrap">
            <img className="staffDialogOrbit" src={staffCardOrbit} alt="" aria-hidden="true" />
            <h2>{staff.displayName || staff.nickname}</h2>
          </div>
          {staff.nickname && staff.nickname !== staff.displayName ? <p className="staffNickname"><span aria-hidden="true">✦</span>暱稱｜{staff.nickname}<span aria-hidden="true">✦</span></p> : null}
          <div className="staffCardDivider" aria-hidden="true"><span /><i>✦</i><span /></div>
          <p className="staffDetailText">{staff.detail}</p>
          <ServiceTable title="共通服務" type="common" services={staff.commonServices} />
          <ServiceTable title="個人特殊服務" type="special" services={staff.specialServices} />
        </div>
      </div>
    </Modal>
  );
}

function ServiceTable({ title, type, services }) {
  return (
    <div className="serviceTable">
      <div className="serviceTableHeading">
        <img src={getStaffCardChipIcon(type)} alt="" aria-hidden="true" />
        <h3>{title}</h3>
      </div>
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
