import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">SocialApp</Link>
      <div className="navbar-links">
        {user ? (
          <>
            <Link to="/">Feed</Link>
            <Link to="/search">Search</Link>
            <Link to="/businesses">Businesses</Link>
            <Link to="/events">Events</Link>
            <Link to="/chat">Chat</Link>
            <Link to="/profile">Profile</Link>
            <span className="navbar-user">@{user.username}</span>
            <button type="button" className="btn-link" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/businesses">Businesses</Link>
            <Link to="/events">Events</Link>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
