import { useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { events } from '../mockData.js';

const today = new Date('2026-07-01T00:00:00+08:00');

function isExpired(event) {
  return new Date(`${event.endAt}T23:59:59+08:00`) < today;
}

export function EventPage() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const visibleEvents = events
    .filter((event) => !isExpired(event))
    .sort((a, b) => Number(b.status === '生效中') - Number(a.status === '生效中'));

  return (
    <PageFrame eyebrow="Festival Briefing" title="慶典情報" intro="所有近期可參與的沙龍企劃都收在此處，生效中的活動會優先排列。">
      <div className="eventList">
        {visibleEvents.map((event) => (
          <button className="eventCard" type="button" key={event.id} onClick={() => setSelectedEvent(event)}>
            <img src={event.imageUrl} alt="" loading="lazy" />
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

function EventModal({ event, onClose }) {
  if (!event) return null;

  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="eventDialog">
        {event.imageUrl ? <img src={event.imageUrl} alt={`${event.title} 活動照片`} /> : null}
        <div>
          <div className="cardMeta">
            <StatusBadge tone={event.status === '生效中' ? 'accent' : 'muted'}>{event.status}</StatusBadge>
            <span>{event.period}</span>
          </div>
          <h2>{event.title}</h2>
          {event.details.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </Modal>
  );
}
