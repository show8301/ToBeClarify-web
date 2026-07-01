import { useState } from 'react';
import { PageFrame } from '../components/PageFrame.jsx';
import { StaffDetailModal } from '../components/StaffDetailModal.jsx';
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

      <StaffDetailModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
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
