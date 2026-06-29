import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { staffMembers } from '../mockData.js';

export function StaffPage() {
  const [selectedStaff, setSelectedStaff] = useState(null);

  return (
    <PageFrame eyebrow="Staff Collection" title="店員珍藏" intro="翻閱今夜沙龍名冊，選擇想進一步了解的陪伴風格與服務內容。">
      <div className="staffGrid">
        {staffMembers.map((staff) => (
          <StaffCard staff={staff} key={staff.id} onSelect={() => setSelectedStaff(staff)} />
        ))}
      </div>

      <StaffModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
    </PageFrame>
  );
}

function StaffCard({ staff, onSelect }) {
  return (
    <button className="staffCard" type="button" onClick={onSelect}>
      <div className="staffPortrait">
        <img src={staff.avatarUrl} alt={`${staff.nickname} 頭貼`} loading="lazy" />
        <StatusBadge tone={staff.todayShift === '休假' ? 'muted' : 'success'}>{staff.todayShift}</StatusBadge>
      </div>
      <div className="staffCardBody">
        <p className="eyebrow">{staff.role}</p>
        <h2>{staff.nickname}</h2>
        <p>{staff.intro}</p>
        <div className="chipList">
          {staff.commonServices.slice(0, 2).map((service) => (
            <span className="chip" key={service.name}>
              {service.name}
            </span>
          ))}
          {staff.specialServices.slice(0, 1).map((service) => (
            <span className="chip accentChip" key={service.name}>
              {service.name}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function StaffModal({ staff, onClose }) {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [staff]);

  if (!staff) return null;

  const activeImage = staff.gallery[imageIndex];

  return (
    <Modal title={staff.nickname} onClose={onClose}>
      <div className="staffDialog">
        <div className="dialogGallery">
          <img src={activeImage} alt={`${staff.nickname} 形象照片`} />
          <div className="galleryControls" aria-label="店員照片輪播">
            {staff.gallery.map((image, index) => (
              <button
                className={index === imageIndex ? 'dot active' : 'dot'}
                type="button"
                key={image}
                aria-label={`切換至第 ${index + 1} 張照片`}
                onClick={() => setImageIndex(index)}
              />
            ))}
          </div>
        </div>
        <div className="dialogContent">
          <p className="eyebrow">{staff.role}</p>
          <h2>{staff.nickname}</h2>
          <StatusBadge tone={staff.todayShift === '休假' ? 'muted' : 'success'}>
            {staff.todayShift}
          </StatusBadge>
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
