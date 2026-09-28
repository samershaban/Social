import { Link } from 'react-router-dom';
import { formatEventDate } from '../eventDate';

export default function EventCard({ event }) {
  return (
    <Link to={`/events/${event.id}`} className="event-card">
      <h3>{event.title}</h3>
      {event.performer.genre && <span className="event-genre">{event.performer.genre}</span>}
      <p className="event-date">{formatEventDate(event.eventDate)}</p>
      <p className="event-venue">
        {event.performer.name} · {event.venue.name}
        {event.venue.city && `, ${event.venue.city}`}
      </p>
    </Link>
  );
}
