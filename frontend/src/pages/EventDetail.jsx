import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import EventForm from '../components/EventForm';
import { formatEventDate } from '../eventDate';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .getEvent(id)
      .then(setEvent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleUpdate(body) {
    const updated = await api.updateEvent(id, body);
    setEvent(updated);
    setEditing(false);
  }

  async function handleDelete() {
    try {
      await api.deleteEvent(id);
      navigate('/events');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="loading">Loading event...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!event) return <p className="error">Event not found</p>;

  const isOwner = user?.id === event.organizer.id;

  return (
    <div className="event-detail-page">
      <header className="event-detail-header">
        {editing ? (
          <EventForm initialValues={event} submitLabel="Save" onSubmit={handleUpdate} />
        ) : (
          <>
            <h1>{event.title}</h1>
            {event.performer.genre && <span className="event-genre">{event.performer.genre}</span>}
            <p className="event-date">{formatEventDate(event.eventDate)}</p>
            <div className="event-detail-meta">
              <span>{event.performer.name}</span>
              <span>
                {event.venue.name}
                {event.venue.city && `, ${event.venue.city}`}
              </span>
            </div>
            {event.description && (
              <p className="event-detail-description">{event.description}</p>
            )}
            <p className="event-venue">Posted by @{event.organizer.username}</p>
            {error && <p className="error">{error}</p>}
            {isOwner && (
              <div className="event-detail-actions">
                <button type="button" className="btn-sm" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button type="button" className="btn-danger btn-sm" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </header>
    </div>
  );
}
