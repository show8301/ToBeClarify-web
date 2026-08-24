import { useState } from 'react';
import { PageFrame } from '../components/PageFrame.jsx';
import { StaffDetailModal } from '../components/StaffDetailModal.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { ImageWithLoading } from '../components/ImageWithLoading.jsx';
import { adaptStaff } from '../api/adapters.js';
import { clientApi } from '../api/client.js';
import { ApiState } from '../components/ApiState.jsx';
import { useApiResource } from '../data/useApiResource.js';
import { getStaffCardChipIcon, staffCardOrbit } from '../components/StaffCardDecorations.jsx';

export function StaffPage() {
  const resource = useApiResource(async (signal) => (
    await clientApi.getStaffMembers(signal)
  ).map((staff) => adaptStaff(staff)), []);
  const staffMembers = resource.data || [];
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
      <ApiState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
        <div className="staffGrid">
          {staffMembers.map((staff) => (
            <StaffCard staff={staff} key={staff.id} onSelect={() => selectStaff(staff)} />
          ))}
        </div>
      </ApiState>

      {detailError ? <p className="inlineApiError" role="alert">{detailError.message}</p> : null}

      <StaffDetailModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
    </PageFrame>
  );
}

function StaffCard({ staff, onSelect }) {
  const displayName = staff.displayName || staff.nickname;

  return (
    <button className="staffCard" type="button" onClick={onSelect}>
      <div className="staffPortrait">
        <ImageWithLoading src={staff.avatarUrl} alt={`${displayName} 頭貼`} />
        {staff.role ? <div className="staffCardRole"><span aria-hidden="true">✦</span><span>{staff.role}</span><span aria-hidden="true">✦</span></div> : null}
        <StatusBadge tone={staff.isWorkingToday ? 'success' : 'muted'}>{staff.isWorkingToday ? '今天上班' : '今天休假'}</StatusBadge>
      </div>
      <div className="staffCardBody">
        <div className="staffCardNameWrap">
          <img className="staffCardOrbit" src={staffCardOrbit} alt="" aria-hidden="true" />
          <h2>{displayName}</h2>
        </div>
        {staff.nickname && staff.nickname !== staff.displayName ? <p className="staffNickname"><span aria-hidden="true">✦</span>暱稱｜{staff.nickname}<span aria-hidden="true">✦</span></p> : null}
        <p className="staffCardIntro">{staff.intro}</p>
        <div className="staffCardDivider" aria-hidden="true"><span /><i>✦</i><span /></div>
        <div className="chipList">
          {staff.commonServices.slice(0, 2).map((service, index) => (
            <span className="chip staffCardChip" key={service.name}>
              <img src={getStaffCardChipIcon('common', index)} alt="" aria-hidden="true" />
              <span>{service.name}</span>
            </span>
          ))}
          {staff.specialServices.slice(0, 1).map((service) => (
            <span className="chip accentChip staffCardChip" key={service.name}>
              <img src={getStaffCardChipIcon('special')} alt="" aria-hidden="true" />
              <span>{service.name}</span>
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
