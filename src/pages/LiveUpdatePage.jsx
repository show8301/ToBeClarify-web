import { useMemo, useState } from 'react';
import { PageFrame } from '../components/PageFrame.jsx';
import { StaffDetailModal } from '../components/StaffDetailModal.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { liveUpdate, staffMembers } from '../mockData.js';

function formatLiveTime(value) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function getStaffName(staffId) {
  return staffMembers.find((staff) => staff.id === staffId)?.nickname || '未指名';
}

function statusTone(status) {
  if (status === 'available') return 'success';
  if (status === 'occupied' || status === 'busy') return 'accent';
  return 'muted';
}

function statusLabel(status) {
  if (status === 'available') return '空位';
  if (status === 'occupied') return '使用中';
  if (status === 'reserved') return '保留中';
  if (status === 'busy') return '指名中';
  if (status === 'off') return '未上班';
  return status;
}

export function LiveUpdatePage() {
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [activeSeatId, setActiveSeatId] = useState(liveUpdate.openSeats[0]?.id || null);
  const activeSeat = liveUpdate.openSeats.find((seat) => seat.id === activeSeatId);
  const staffStatusRows = useMemo(
    () =>
      liveUpdate.staffStatuses.map((row) => ({
        ...row,
        staff: staffMembers.find((staff) => staff.id === row.staffId),
      })),
    [],
  );

  return (
    <PageFrame eyebrow="Live Update" title="店舖動態" intro="即時展示開放座位、包廂與店員指名狀態。此頁僅供瀏覽，不提供操作。">
      <section className="liveHeader">
        <p>最後更新時間</p>
        <strong>{formatLiveTime(liveUpdate.lastUpdatedAt)}</strong>
      </section>

      <section className="liveLayout">
        <div className="floorPlanPanel">
          <div className="floorPlanHeader">
            <p className="eyebrow">Floor Plan</p>
            <h2>開放區座位</h2>
          </div>
          <div className="floorPlan">
            <div className="floorZone barZone">吧台</div>
            <div className="floorZone loungeZone">沙發區</div>
            <div className="floorZone entranceZone">入口</div>
            <div className="floorZone stageZone">小舞台</div>
            {liveUpdate.openSeats.map((seat) => (
              <SeatMarker
                seat={seat}
                key={seat.id}
                isActive={seat.id === activeSeatId}
                onSelect={() => setActiveSeatId((current) => (current === seat.id ? null : seat.id))}
              />
            ))}
          </div>
          {activeSeat ? <SeatDetailCard item={activeSeat} /> : null}
        </div>

        <aside className="roomPanel">
          <p className="eyebrow">Private Rooms</p>
          <h2>包廂狀態</h2>
          <div className="roomList">
            {liveUpdate.rooms.map((room) => (
              <SeatTile item={room} key={room.id} compact />
            ))}
          </div>
        </aside>
      </section>

      <section className="staffStatusSection">
        <div className="sectionTitle">
          <p className="eyebrow">Staff Status</p>
          <h2>店員狀態</h2>
        </div>
        <div className="staffStatusGrid">
          {staffStatusRows.map(({ staff, status, label }) => (
            <button
              className={`staffStatusCard ${status}`}
              type="button"
              key={staff.id}
              onClick={() => setSelectedStaff(staff)}
            >
              <img src={staff.avatarUrl} alt={`${staff.nickname} 頭貼`} loading="lazy" />
              <span>{staff.nickname}</span>
              <StatusBadge tone={statusTone(status)}>{label}</StatusBadge>
            </button>
          ))}
        </div>
      </section>

      <StaffDetailModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
    </PageFrame>
  );
}

function SeatTile({ item, compact = false }) {
  return (
    <article className={`seatTile ${item.status} ${compact ? 'compact' : ''}`}>
      <div className="seatTileHeader">
        <strong>{item.label || item.name}</strong>
        <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusBadge>
      </div>
      <dl>
        <div>
          <dt>客人</dt>
          <dd>{item.guestName || '尚未入席'}</dd>
        </div>
        <div>
          <dt>指名</dt>
          <dd>{getStaffName(item.staffId)}</dd>
        </div>
      </dl>
    </article>
  );
}

function SeatMarker({ seat, isActive, onSelect }) {
  return (
    <button
      className={`seatMarker ${seat.status} ${isActive ? 'active' : ''}`}
      type="button"
      style={{ left: `${seat.position.x}%`, top: `${seat.position.y}%` }}
      aria-label={`${seat.label} ${statusLabel(seat.status)}`}
      onClick={onSelect}
    >
      <span>{seat.id}</span>
      <SeatTooltip item={seat} />
    </button>
  );
}

function SeatTooltip({ item }) {
  return (
    <span className="seatTooltip">
      <strong>{item.label}</strong>
      <em>{statusLabel(item.status)}</em>
      <span>客人：{item.guestName || '尚未入席'}</span>
      <span>指名：{getStaffName(item.staffId)}</span>
    </span>
  );
}

function SeatDetailCard({ item }) {
  return (
    <article className={`selectedSeatCard ${item.status}`}>
      <div>
        <p className="eyebrow">Selected Seat</p>
        <h3>{item.label}</h3>
      </div>
      <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusBadge>
      <dl>
        <div>
          <dt>客人</dt>
          <dd>{item.guestName || '尚未入席'}</dd>
        </div>
        <div>
          <dt>指名</dt>
          <dd>{getStaffName(item.staffId)}</dd>
        </div>
      </dl>
    </article>
  );
}
