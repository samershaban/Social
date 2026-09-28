import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import EventForm from '../components/EventForm';

export default function PostEvent() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  async function handleCreate(body) {
    const event = await api.createEvent(body);
    navigate(`/events/${event.id}`);
  }

  if (loading) return <p className="loading">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="post-event-page">
      <h1>Post an Event</h1>
      <EventForm onSubmit={handleCreate} />
    </div>
  );
}
