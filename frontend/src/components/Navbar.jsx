import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">SocialApp</Link>
      <div className="navbar-links">
        <Link to="/">Feed</Link>
        {user ? (
          <>
            <Link to="/profile">Profile</Link>
            <span className="navbar-user">@{user.username}</span>
            <button type="button" className="btn-link" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
