import { clientApi } from '../api/client.js';
import { ApiState } from '../components/ApiState.jsx';
import { ImageWithLoading } from '../components/ImageWithLoading.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApiResource } from '../data/useApiResource.js';

function formatGil(value) {
  return `${new Intl.NumberFormat('zh-TW').format(value)} Gil`;
}

const podiumOrder = [1, 0, 2];

export function RankingPage({ variant = 'staff' }) {
  const isStaffRanking = variant === 'staff';
  const type = isStaffRanking ? 'staffRanking' : 'monetaryRanking';
  const resource = useApiResource((signal) => clientApi.getRankings(type, null, signal), [type]);
  const rankings = resource.data || [];

  return (
    <PageFrame
      eyebrow="Hall of Honor"
      title={isStaffRanking ? '店員榜' : '消費榜'}
      intro={isStaffRanking ? '展示最近 30 天的店員指名人氣排行。' : '展示貴賓公開 ID 的累計消費排行。'}
    >
      <ApiState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
        {isStaffRanking ? (
        <RankingSection
          eyebrow="Staff Ranking"
          title="店員榜"
          description="最近 30 天被指名次數排行。"
          podiumItems={rankings.slice(0, 3)}
          listItems={rankings.slice(3)}
          renderPodium={(item) => <StaffPodiumCard item={item} rank={item.rankPosition} />}
          renderRow={(item) => <StaffRankingRow item={item} rank={item.rankPosition} />}
        />
      ) : (
        <RankingSection
          eyebrow="Guest Ranking"
          title="消費榜"
          description="依照已消費總金額排序，僅顯示公開用客人 ID。"
          podiumItems={rankings.slice(0, 3)}
          listItems={rankings.slice(3)}
          renderPodium={(item) => <GuestPodiumCard item={item} rank={item.rankPosition} />}
          renderRow={(item) => <GuestRankingRow item={item} rank={item.rankPosition} />}
        />
        )}
      </ApiState>
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
        {podiumOrder.filter((itemIndex) => itemIndex < podiumItems.length).map((itemIndex) => (
          <div className={`podiumSlot rank${itemIndex + 1}`} key={itemIndex}>
            {renderPodium(podiumItems[itemIndex])}
          </div>
        ))}
      </div>

      {listItems.length > 0 ? (
        <div className="rankingList">
          {listItems.map((item, index) => (
            <div className="rankingRowWrap" key={item.id}>
              {renderRow(item)}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StaffPodiumCard({ item, rank }) {
  return (
    <article className="podiumCard staffPodium">
      <span className="rankBadge">No.{rank}</span>
      <ImageWithLoading src={item.avatar} alt={`${item.displayName} 頭貼`} />
      <h3>{item.displayName}</h3>
      <strong>{item.scoreLabel || `${item.scoreValue} 次指名`}</strong>
      {rank === 1 && item.titleBadge ? <p className="declaration">「{item.titleBadge}」</p> : null}
    </article>
  );
}

function GuestPodiumCard({ item, rank }) {
  return (
    <article className="podiumCard guestPodium">
      <span className="rankBadge">No.{rank}</span>
      <h3>{item.displayName}</h3>
      {item.titleBadge ? <StatusBadge tone="accent">{item.titleBadge}</StatusBadge> : null}
      <strong>{item.scoreLabel || formatGil(item.scoreValue)}</strong>
    </article>
  );
}

function StaffRankingRow({ item, rank }) {
  return (
    <article className="rankingRow">
      <span>No.{rank}</span>
      <strong>{item.displayName}</strong>
      <em>{item.scoreLabel || `${item.scoreValue} 次指名`}</em>
    </article>
  );
}

function GuestRankingRow({ item, rank }) {
  return (
    <article className="rankingRow">
      <span>No.{rank}</span>
      <strong>{item.displayName}</strong>
      <em>{item.scoreLabel || formatGil(item.scoreValue)}</em>
    </article>
  );
}
