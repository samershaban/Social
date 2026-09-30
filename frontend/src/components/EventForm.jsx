import { useState, useEffect } from 'react';
import { api } from '../api';
import { toDateTimeInputValue } from '../eventDate';

export default function EventForm({ onSubmit, initialValues, submitLabel = 'Post Event' }) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [eventDate, setEventDate] = useState(toDateTimeInputValue(initialValues?.eventDate));
  const [venueName, setVenueName] = useState(initialValues?.venue?.name || '');
  const [venueCity, setVenueCity] = useState(initialValues?.venue?.city || '');
  const [performerName, setPerformerName] = useState(initialValues?.performer?.name || '');
  const [performerGenre, setPerformerGenre] = useState(initialValues?.performer?.genre || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [capacity, setCapacity] = useState(
    initialValues?.tickets ? String(initialValues.tickets.capacity) : ''
  );
  const [maxPerUser, setMaxPerUser] = useState(
    initialValues?.tickets ? String(initialValues.tickets.maxPerUser) : ''
  );
  const [venues, setVenues] = useState([]);
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Autocomplete suggestions only. The backend resolves a venue or performer by name and
  // creates it when new, so a failure here just means no dropdown -- never a blocked submit.
  useEffect(() => {
    Promise.all([api.getVenues(), api.getPerformers()])
      .then(([venueList, performerList]) => {
        setVenues(venueList);
        setPerformers(performerList);
      })
      .catch(() => {});
  }, []);

  const canSubmit =
    Boolean(title.trim()) && Boolean(eventDate) && Boolean(venueName.trim()) && Boolean(performerName.trim());

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');
    try {
      await onSubmit({
        title,
        eventDate,
        venueName,
        venueCity,
        performerName,
        performerGenre,
        description,
        capacity,
        maxPerUser,
      });
      if (!initialValues) {
        setTitle('');
        setEventDate('');
        setVenueName('');
        setVenueCity('');
        setPerformerName('');
        setPerformerGenre('');
        setDescription('');
        setCapacity('');
        setMaxPerUser('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event title"
        maxLength={160}
      />
      <input
        type="datetime-local"
        value={eventDate}
        onChange={(e) => setEventDate(e.target.value)}
        aria-label="Event date and time"
      />
      <input
        value={venueName}
        onChange={(e) => setVenueName(e.target.value)}
        placeholder="Venue"
        list="venue-options"
        maxLength={120}
      />
      <datalist id="venue-options">
        {venues.map((venue) => (
          <option key={venue.id} value={venue.name} />
        ))}
      </datalist>
      <input
        value={venueCity}
        onChange={(e) => setVenueCity(e.target.value)}
        placeholder="City (optional)"
        maxLength={120}
      />
      <input
        value={performerName}
        onChange={(e) => setPerformerName(e.target.value)}
        placeholder="Performer"
        list="performer-options"
        maxLength={120}
      />
      <datalist id="performer-options">
        {performers.map((performer) => (
          <option key={performer.id} value={performer.name} />
        ))}
      </datalist>
      <input
        value={performerGenre}
        onChange={(e) => setPerformerGenre(e.target.value)}
        placeholder="Genre (optional)"
        maxLength={80}
      />
      <input
        type="number"
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        placeholder="Total tickets (0 for none)"
        aria-label="Total tickets"
        min={0}
        max={10000}
      />
      <input
        type="number"
        value={maxPerUser}
        onChange={(e) => setMaxPerUser(e.target.value)}
        placeholder="Max tickets per person (default 4)"
        aria-label="Max tickets per person"
        min={1}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={3}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading || !canSubmit}>
        {loading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
