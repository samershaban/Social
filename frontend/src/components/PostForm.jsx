import { useState } from 'react';

export default function PostForm({ onSubmit }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;

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
        placeholder="What's on your mind?"
        rows={3}
        maxLength={500}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading || !content.trim()}>
        {loading ? 'Posting...' : 'Post'}
      </button>
    </form>
  );
}
