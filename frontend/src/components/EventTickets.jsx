import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Reserving and releasing both return the refreshed event, so the parent's availability figures
// stay in step without a second request.
export default function EventTickets({ event, onEventChange }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setTickets([]);
      setLoaded(true);
      return;
    }

    let active = true;
    setLoaded(false);
    api
      .getMyTickets(event.id)
      .then((mine) => {
        if (active) setTickets(mine);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [user, event.id]);

  const { capacity, available, maxPerUser } = event.tickets;
  const allowanceLeft = Math.max(maxPerUser - tickets.length, 0);
  const maxSelectable = Math.min(available, allowanceLeft);

  async function handleReserve(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.reserveTickets(event.id, Math.min(quantity, maxSelectable));
      setTickets(result.tickets);
      onEventChange(result.event);
      setQuantity(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease(ticketId) {
    setBusy(true);
    setError('');
    try {
      const result = await api.releaseTicket(ticketId);
      setTickets(result.tickets);
      onEventChange(result.event);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="event-tickets">
      <h2>Tickets</h2>
      {capacity === 0 ? (
        <p className="empty">No tickets are being offered for this event.</p>
      ) : (
        <>
          <p className="event-tickets-summary">
            {available > 0
              ? `${available} of ${capacity} tickets left`
              : `Sold out — all ${capacity} tickets reserved`}
            {` · up to ${maxPerUser} per person`}
          </p>
          {error && <p className="error">{error}</p>}
          {!user ? (
            <p className="empty">Log in to reserve tickets.</p>
          ) : !loaded ? (
            <p className="loading">Loading your tickets...</p>
          ) : (
            <>
              {tickets.length > 0 && (
                <ul className="ticket-list">
                  {tickets.map((ticket) => (
                    <li key={ticket.id} className="ticket-row">
                      <span className="ticket-seat">Seat {ticket.seatNumber}</span>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => handleRelease(ticket.id)}
                      >
                        Release
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {maxSelectable > 0 ? (
                <form className="ticket-reserve" onSubmit={handleReserve}>
                  <select
                    value={Math.min(quantity, maxSelectable)}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    aria-label="Number of tickets"
                  >
                    {Array.from({ length: maxSelectable }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={busy}>
                    {busy ? 'Reserving...' : 'Reserve'}
                  </button>
                </form>
              ) : (
                <p className="empty">
                  {available === 0
                    ? 'There are no tickets left.'
                    : `You already hold the maximum of ${maxPerUser}.`}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
