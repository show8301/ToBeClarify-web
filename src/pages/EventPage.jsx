import { useState } from 'react';
import { EventModal } from '../components/EventModal.jsx';
import { ImageWithLoading } from '../components/ImageWithLoading.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApiData } from '../data/ApiDataContext.jsx';

export function EventPage() {
  const { events } = useApiData();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const visibleEvents = events
    .filter((event) => event.status !== '已失效')
    .sort((a, b) => Number(b.status === '生效中') - Number(a.status === '生效中'));

  return (
    <PageFrame eyebrow="Festival Briefing" title="慶典情報" intro="所有近期可參與的沙龍企劃都收在此處，生效中的活動會優先排列。">
      <div className="eventList">
        {visibleEvents.map((event) => (
          <button className="eventCard" type="button" key={event.id} onClick={() => setSelectedEvent(event)}>
            <ImageWithLoading src={event.imageUrl} alt="" />
            <div>
              <div className="cardMeta">
                <StatusBadge tone={event.status === '生效中' ? 'accent' : 'muted'}>{event.status}</StatusBadge>
                <span>{event.period}</span>
              </div>
              <h2>{event.title}</h2>
              <p>{event.summary}</p>
            </div>
          </button>
        ))}
      </div>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </PageFrame>
  );
}
