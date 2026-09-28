// Presentational and fully controlled: the parent owns the draft so a back-button change to
// the URL flows back into the inputs. Submitting explicitly rather than debouncing keeps four
// fields from firing four independent searches and stacking up history entries.
export default function EventFilters({ values, onChange, onSubmit, onClear }) {
  function handleSubmit(e) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form className="event-filters" onSubmit={handleSubmit}>
      <input
        className="event-search"
        value={values.q}
        onChange={(e) => onChange('q', e.target.value)}
        placeholder="Search events, performers, venues"
        aria-label="Search events"
        maxLength={200}
      />
      <input
        type="date"
        value={values.date}
        onChange={(e) => onChange('date', e.target.value)}
        aria-label="Event date"
      />
      <input
        value={values.venue}
        onChange={(e) => onChange('venue', e.target.value)}
        placeholder="Venue or city"
        aria-label="Venue or city"
        maxLength={120}
      />
      <input
        value={values.performer}
        onChange={(e) => onChange('performer', e.target.value)}
        placeholder="Performer"
        aria-label="Performer"
        maxLength={120}
      />
      <div className="event-filters-actions">
        <button type="submit">Search</button>
        <button type="button" className="btn-secondary" onClick={onClear}>
          Clear
        </button>
      </div>
    </form>
  );
}
