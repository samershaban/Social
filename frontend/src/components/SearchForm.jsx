import { useState, useEffect, useRef } from 'react';

export default function SearchForm({ onSubmit, placeholder = 'Search Users' }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const onSubmitRef = useRef(onSubmit);

  onSubmitRef.current = onSubmit;

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      onSubmitRef.current('');
      return;
    }

    setLoading(true);
    setError('');

    const timeout = setTimeout(async () => {
      try {
        await onSubmitRef.current(trimmed);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <form className="post-form" onSubmit={(e) => e.preventDefault()}>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        rows={1}
        maxLength={50}
      />
      {error && <p className="error">{error}</p>}
      {loading && query.length>0 && <p className="loading">Searching...</p>}
    </form>
  );
}
