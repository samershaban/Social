import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import BusinessCard from '../components/BusinessCard';
import SearchForm from '../components/SearchForm';

export default function Businesses() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getBusinesses()
      .then(setBusinesses)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSearch(q) {
    setSearchQuery(q);
    try {
      const results = q ? await api.searchBusinesses(q) : await api.getBusinesses();
      setBusinesses(results);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="loading">Loading businesses...</p>;

  return (
    <div className="businesses-page">
      <h1>Businesses</h1>
      <SearchForm onSubmit={handleSearch} placeholder="Search businesses" />
      {user && (
        <div className="businesses-actions">
          <Link to="/businesses/new" className="btn-link-button">
            Post a Business
          </Link>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {businesses.length === 0 ? (
        <p className="empty">
          {searchQuery ? 'No businesses found.' : 'No businesses yet. Be the first to post one!'}
        </p>
      ) : (
        <div className="business-list">
          {businesses.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      )}
    </div>
  );
}
