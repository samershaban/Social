import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import SearchForm from '../components/SearchForm';
import { Link } from 'react-router-dom';

export default function Feed() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadUsers() {
    try {
      const data = await api.searchUsers('e', 3);
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadUsers();
  }, [user]);

  async function handleSearch(content) {
    console.log(content);
    const newUsers = await api.searchUsers(content, 10);
    setUsers(newUsers);
  }


  if (loading) return <p className="loading">Loading feed...</p>;

  return (
    <div className="feed-page">
      <h1>Search Users</h1>
      {user && <SearchForm onSubmit={handleSearch} />}
      {error && <p className="error">{error}</p>}
      {users.length === 0 ? (
        <p className="empty">No Users with specified search</p>
      ) : (
        <div className="profile-page">
          {users.map((user, id) => (<header className="profile-header" key={id}>
            <h1>
            <Link to={`/users/${user.id}`} className="post-author">
              @{user.username}
            </Link>
            </h1>
            <div>{user.id}</div>
          </header>))}
        </div>
      )}
    </div>
  );
}
