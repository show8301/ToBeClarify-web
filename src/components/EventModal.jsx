import { Modal } from './Modal.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { ImageWithLoading } from './ImageWithLoading.jsx';

export function EventModal({ event, onClose }) {
  if (!event) return null;

  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="eventDialog">
        {event.imageUrl ? <ImageWithLoading src={event.imageUrl} alt={`${event.title} 活動照片`} loading="eager" /> : null}
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
