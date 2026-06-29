import { DarkCard } from '../components/DarkCard.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { updates } from '../mockData.js';

export function UpdatesPage({ navigate }) {
  return (
    <PageFrame eyebrow="Salon Board" title="店舖動態" intro="整合近期公告、班表摘要與入場提醒，第一版先提供靜態瀏覽入口。">
      <div className="updatesGrid">
        {updates.map((update) => (
          <DarkCard key={update.title}>
            <StatusBadge tone={update.tone}>{update.type}</StatusBadge>
            <h2>{update.title}</h2>
            <p>{update.description}</p>
            {update.action ? (
              <button className="textButton" type="button" onClick={() => navigate(update.action.href)}>
                {update.action.label}
              </button>
            ) : null}
          </DarkCard>
        ))}
      </div>
    </PageFrame>
  );
}
