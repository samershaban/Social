import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';
import EventFilters from '../components/EventFilters';

const EMPTY_FILTERS = { q: '', date: '', venue: '', performer: '' };

function readFilters(searchParams) {
  return {
    q: searchParams.get('q') || '',
    date: searchParams.get('date') || '',
    venue: searchParams.get('venue') || '',
    performer: searchParams.get('performer') || '',
  };
}

export default function Events() {
  const { user } = useAuth();
  // Filters live in the URL so a search can be shared, bookmarked, refreshed and stepped
  // through with the back button.
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [draft, setDraft] = useState(() => readFilters(searchParams));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const queryString = searchParams.toString();

  useEffect(() => {
    setDraft(readFilters(new URLSearchParams(queryString)));
  }, [queryString]);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getEvents(readFilters(new URLSearchParams(queryString)))
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [queryString]);

  function handleChange(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const next = {};
    Object.entries(draft).forEach(([key, value]) => {
      if (value.trim()) next[key] = value.trim();
    });
    setSearchParams(next);
  }

  function handleClear() {
    setDraft(EMPTY_FILTERS);
    setSearchParams({});
  }

  const hasFilters = queryString.length > 0;

  return (
    <div className="events-page">
      <h1>Events</h1>
      {/* Rendered even while loading, so the inputs keep their focus between searches. */}
      <EventFilters
        values={draft}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />
      {user && (
        <div className="events-actions">
          <Link to="/events/new" className="btn-link-button">
            Post an Event
          </Link>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="loading">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="empty">
          {hasFilters
            ? 'No events match these filters.'
            : 'No upcoming events yet. Be the first to post one!'}
        </p>
      ) : (
        <div className="event-list">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
