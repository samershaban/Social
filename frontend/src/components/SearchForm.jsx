import { useState } from 'react';

export default function SearchForm({ onSubmit }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    // if (!content.trim()) return;

    setLoading(true);
    setError('');
    try {
      await onSubmit(content);
      setContent('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Search Users"
        rows={1}
        maxLength={20}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading || !content.trim()}>
        {loading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}
