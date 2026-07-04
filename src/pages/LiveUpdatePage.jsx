import { useMemo, useState } from 'react';
import Timeline, { DateHeader, SidebarHeader, TimelineHeaders } from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
import { PageFrame } from '../components/PageFrame.jsx';
import { StaffDetailModal } from '../components/StaffDetailModal.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { liveUpdate, staffMembers } from '../mockData.js';

const TIMELINE_DAY = new Date(2026, 6, 1, 0, 0, 0, 0).getTime();
const HOUR = 60 * 60 * 1000;

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

function parseTimeToMinutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function timeToTimestamp(value) {
  return TIMELINE_DAY + parseTimeToMinutes(value) * 60 * 1000;
}

function formatTimelineTime(timestamp) {
  const totalMinutes = Math.round((timestamp - TIMELINE_DAY) / 60000);
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minute = String(totalMinutes % 60).padStart(2, '0');
  return `${hour}:${minute}`;
}

function getStaff(staffId) {
  return staffMembers.find((staff) => staff.id === staffId);
}

function statusTone(status) {
  if (status === 'available') return 'success';
  if (status === 'busy') return 'accent';
  return 'muted';
}

function reservationLabel(status) {
  if (status === 'active') return '指名中';
  if (status === 'finished') return '已結束';
  if (status === 'reserved') return '待入席';
  return status;
}

function formatReservationTime(reservation) {
  return `${reservation.startAt}~${reservation.endAt}`;
}

function getScheduleStatus(status) {
  if (status === 'busy') return 'active';
  if (status === 'available') return 'available';
  return 'off';
}

function clampVisibleRange(start, end, minTime, maxTime) {
  const duration = end - start;
  if (start < minTime) return [minTime, minTime + duration];
  if (end > maxTime) return [maxTime - duration, maxTime];
  return [start, end];
}

export function LiveUpdatePage() {
  const [selectedStaff, setSelectedStaff] = useState(null);
  const minTime = timeToTimestamp(liveUpdate.scheduleStart);
  const maxTime = timeToTimestamp(liveUpdate.scheduleEnd);
  const initialVisibleEnd = Math.min(maxTime, minTime + 3 * HOUR);
  const [visibleRange, setVisibleRange] = useState([minTime, initialVisibleEnd]);

  const staffStatusRows = useMemo(
    () =>
      liveUpdate.staffStatuses.map((row) => ({
        ...row,
        staff: getStaff(row.staffId),
      })),
    [],
  );

  const workingStaffRows = useMemo(
    () =>
      staffStatusRows
        .filter(({ status, staff }) => status !== 'off' && staff)
        .map(({ staff, label, status }) => ({ staff, label, status })),
    [staffStatusRows],
  );

  const groups = useMemo(
    () =>
      workingStaffRows.map(({ staff, label, status }) => ({
        id: staff.id,
        title: staff.nickname,
        label,
        status,
        avatarUrl: staff.avatarUrl,
      })),
    [workingStaffRows],
  );

  const items = useMemo(
    () =>
      liveUpdate.reservations.map((reservation) => ({
        id: reservation.id,
        group: reservation.staffId,
        title: `${reservation.serviceName} ${reservation.startAt} - ${reservation.endAt}`,
        start_time: timeToTimestamp(reservation.startAt),
        end_time: timeToTimestamp(reservation.endAt),
        serviceName: reservation.serviceName,
        status: reservation.status,
        statusLabel: reservationLabel(reservation.status),
        startLabel: reservation.startAt,
        endLabel: reservation.endAt,
        timeLabel: formatReservationTime(reservation),
        canMove: false,
        canResize: false,
        canChangeGroup: false,
      })),
    [],
  );

  const compactScheduleRows = useMemo(
    () =>
      staffStatusRows
        .filter(({ staff }) => staff)
        .map(({ staff, status, label }) => {
          const reservations = liveUpdate.reservations.filter((reservation) => reservation.staffId === staff.id);
          const currentReservation = reservations.find((reservation) => reservation.status === 'active');

          return {
            staff,
            statusLabel: label,
            dotStatus: currentReservation?.status || getScheduleStatus(status),
            reservations,
          };
        }),
    [staffStatusRows],
  );

  const handleTimeChange = (visibleTimeStart, visibleTimeEnd, updateScrollCanvas) => {
    const [nextStart, nextEnd] = clampVisibleRange(visibleTimeStart, visibleTimeEnd, minTime, maxTime);
    setVisibleRange([nextStart, nextEnd]);
    updateScrollCanvas(nextStart, nextEnd);
  };

  return (
    <PageFrame
      eyebrow="Live Update"
      title="店舖動態"
      intro="即時展示今日店員預約時間軸與上班狀態。此頁僅供瀏覽，不提供操作。"
    >
      <section className="liveHeader">
        <p>最後更新時間</p>
        <strong>{formatLiveTime(liveUpdate.lastUpdatedAt)}</strong>
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

      <section className="bookingTimelineSection">
        <div className="sectionTitle">
          <p className="eyebrow">Reservation Timeline</p>
          <h2>預約狀態</h2>
        </div>
        <div className="timelineLegend" aria-label="預約狀態圖例">
          <span className="legendItem active">指名中</span>
          <span className="legendItem reserved">待入席</span>
          <span className="legendItem finished">已結束</span>
        </div>
        <div className="bookingTimelineShell">
          <Timeline
            className="staffBookingTimeline"
            groups={groups}
            items={items}
            visibleTimeStart={visibleRange[0]}
            visibleTimeEnd={visibleRange[1]}
            defaultTimeStart={minTime}
            defaultTimeEnd={initialVisibleEnd}
            minZoom={2 * HOUR}
            maxZoom={maxTime - minTime}
            sidebarWidth={112}
            lineHeight={92}
            itemHeightRatio={0.7}
            stackItems={false}
            canMove={false}
            canResize={false}
            canChangeGroup={false}
            canSelect={false}
            timeSteps={{ second: 1, minute: 30, hour: 1, day: 1, month: 1, year: 1 }}
            onTimeChange={handleTimeChange}
            groupRenderer={TimelineGroup}
            itemRenderer={TimelineItem}
          >
            <TimelineHeaders className="timelineHeaders">
              <SidebarHeader>
                {({ getRootProps }) => (
                  <div {...getRootProps({ className: 'timelineSidebarHeader' })}>店員</div>
                )}
              </SidebarHeader>
              <DateHeader
                unit="hour"
                labelFormat={([startTime]) => formatTimelineTime(startTime.valueOf())}
              />
              <DateHeader
                unit="minute"
                labelFormat={([startTime]) => formatTimelineTime(startTime.valueOf())}
              />
            </TimelineHeaders>
          </Timeline>
        </div>

        <div className="compactScheduleList" aria-label="平板與手機預約狀態">
          {compactScheduleRows.map(({ staff, dotStatus, reservations, statusLabel }) => (
            <article className="compactScheduleRow" key={staff.id}>
              <div className="compactScheduleStaff">
                <strong>{staff.nickname}</strong>
                <span className={`scheduleStatusDot ${dotStatus}`} aria-label={statusLabel} />
              </div>
              <div className="compactScheduleTimes">
                {reservations.length > 0 ? (
                  reservations.map((reservation) => (
                    <span className={`compactReservationTime ${reservation.status}`} key={reservation.id}>
                      {formatReservationTime(reservation)}
                    </span>
                  ))
                ) : (
                  <span className="compactReservationTime empty">{statusLabel}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <StaffDetailModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
    </PageFrame>
  );
}

function TimelineGroup({ group }) {
  return (
    <div className={`timelineGroup ${group.status}`}>
      <img src={group.avatarUrl} alt="" loading="lazy" />
      <div>
        <strong>{group.title}</strong>
        <StatusBadge tone={statusTone(group.status)}>{group.label}</StatusBadge>
      </div>
      <span aria-hidden="true" />
    </div>
  );
}

function TimelineItem({ item, itemContext, getItemProps }) {
  const { key, ...itemProps } = getItemProps({
    className: `timelineReservationItem ${item.status}`,
    title: item.title,
  });

  return (
    <div key={key} {...itemProps}>
      <div className="timelineReservationContent" style={{ maxHeight: itemContext.dimensions.height }}>
        <strong>{item.timeLabel}</strong>
        <em>{item.statusLabel}</em>
      </div>
    </div>
  );
}
