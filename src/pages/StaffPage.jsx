import { useState } from 'react';
import { PageFrame } from '../components/PageFrame.jsx';
import { StaffDetailModal } from '../components/StaffDetailModal.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { ImageWithLoading } from '../components/ImageWithLoading.jsx';
import { adaptStaff } from '../api/adapters.js';
import { clientApi } from '../api/client.js';
import { useApiData } from '../data/ApiDataContext.jsx';

export function StaffPage() {
  const { staffMembers } = useApiData();
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [detailError, setDetailError] = useState(null);

  const selectStaff = async (staff) => {
    setDetailError(null);
    try {
      setSelectedStaff(adaptStaff(await clientApi.getStaffDetail(staff.id), true));
    } catch (error) {
      setDetailError(error);
    }
  };

  return (
    <PageFrame eyebrow="Staff Collection" title="店員珍藏" intro="翻閱今夜沙龍名冊，選擇想進一步了解的陪伴風格與服務內容。">
      <div className="staffGrid">
        {staffMembers.map((staff) => (
          <StaffCard staff={staff} key={staff.id} onSelect={() => selectStaff(staff)} />
        ))}
      </div>

      {detailError ? <p className="inlineApiError" role="alert">{detailError.message}</p> : null}

      <StaffDetailModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
    </PageFrame>
  );
}

function StaffCard({ staff, onSelect }) {
  return (
    <button className="staffCard" type="button" onClick={onSelect}>
      <div className="staffPortrait">
        <ImageWithLoading src={staff.avatarUrl} alt={`${staff.nickname} 頭貼`} />
        <StatusBadge tone={staff.isWorkingToday ? 'success' : 'muted'}>{staff.isWorkingToday ? '今天上班' : '今天休假'}</StatusBadge>
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
