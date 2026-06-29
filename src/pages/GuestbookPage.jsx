import { DarkCard } from '../components/DarkCard.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { guestNotes } from '../mockData.js';

export function GuestbookPage() {
  return (
    <PageFrame eyebrow="Guestbook" title="留聲機" intro="留言板在第一版先以展示資料呈現，未來可接後端審核與公開留言 API。">
      <div className="noteList">
        {guestNotes.map((note) => (
          <DarkCard key={note.name}>
            <div className="cardMeta">
              <StatusBadge tone="muted">{note.badge}</StatusBadge>
              <span>{note.date}</span>
            </div>
            <h2>{note.name}</h2>
            <p>{note.message}</p>
          </DarkCard>
        ))}
      </div>
    </PageFrame>
  );
}
