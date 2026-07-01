import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { guestRankings, staffMembers, staffRankings } from '../mockData.js';

function getStaff(staffId) {
  return staffMembers.find((staff) => staff.id === staffId);
}

function formatGil(value) {
  return `${new Intl.NumberFormat('zh-TW').format(value)} Gil`;
}

const podiumOrder = [1, 0, 2];

export function RankingPage({ variant = 'staff' }) {
  const isStaffRanking = variant === 'staff';

  return (
    <PageFrame
      eyebrow="Hall of Honor"
      title={isStaffRanking ? '店員榜' : '消費榜'}
      intro={isStaffRanking ? '展示最近 30 天的店員指名人氣排行。' : '展示貴賓公開 ID 的累計消費排行。'}
    >
      {isStaffRanking ? (
        <RankingSection
          eyebrow="Staff Ranking"
          title="店員榜"
          description="最近 30 天被指名次數排行。"
          podiumItems={staffRankings.slice(0, 3)}
          listItems={staffRankings.slice(3)}
          renderPodium={(item, index) => <StaffPodiumCard item={item} rank={index + 1} />}
          renderRow={(item, index) => <StaffRankingRow item={item} rank={index + 4} />}
        />
      ) : (
        <RankingSection
          eyebrow="Guest Ranking"
          title="消費榜"
          description="依照已消費總金額排序，僅顯示公開用客人 ID。"
          podiumItems={guestRankings.slice(0, 3)}
          listItems={guestRankings.slice(3)}
          renderPodium={(item, index) => <GuestPodiumCard item={item} rank={index + 1} />}
          renderRow={(item, index) => <GuestRankingRow item={item} rank={index + 4} />}
        />
      )}
    </PageFrame>
  );
}

function RankingSection({ eyebrow, title, description, podiumItems, listItems, renderPodium, renderRow }) {
  return (
    <section className="rankingSection">
      <div className="rankingHeader">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusBadge tone="muted">Top 30 Days</StatusBadge>
      </div>

      <div className="podiumGrid">
        {podiumOrder.map((itemIndex) => (
          <div className={`podiumSlot rank${itemIndex + 1}`} key={itemIndex}>
            {renderPodium(podiumItems[itemIndex], itemIndex)}
          </div>
        ))}
      </div>

      {listItems.length > 0 ? (
        <div className="rankingList">
          {listItems.map((item, index) => (
            <div className="rankingRowWrap" key={item.staffId || item.guestId}>
              {renderRow(item, index)}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StaffPodiumCard({ item, rank }) {
  const staff = getStaff(item.staffId);

  return (
    <article className="podiumCard staffPodium">
      <span className="rankBadge">No.{rank}</span>
      <img src={staff.avatarUrl} alt={`${staff.nickname} 頭貼`} loading="lazy" />
      <h3>{staff.nickname}</h3>
      <strong>{item.nominations} 次指名</strong>
      {rank === 1 ? <p className="declaration">「{item.declaration}」</p> : null}
    </article>
  );
}

function GuestPodiumCard({ item, rank }) {
  return (
    <article className="podiumCard guestPodium">
      <span className="rankBadge">No.{rank}</span>
      <h3>{item.guestId}</h3>
      <StatusBadge tone="accent">{item.title}</StatusBadge>
      <strong>{formatGil(item.totalAmount)}</strong>
    </article>
  );
}

function StaffRankingRow({ item, rank }) {
  const staff = getStaff(item.staffId);

  return (
    <article className="rankingRow">
      <span>No.{rank}</span>
      <strong>{staff.nickname}</strong>
      <em>{item.nominations} 次指名</em>
    </article>
  );
}

function GuestRankingRow({ item, rank }) {
  return (
    <article className="rankingRow">
      <span>No.{rank}</span>
      <strong>{item.guestId}</strong>
      <em>{formatGil(item.totalAmount)}</em>
    </article>
  );
}
