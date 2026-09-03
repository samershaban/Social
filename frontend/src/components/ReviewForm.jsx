import { useState } from 'react';
import StarRating from './StarRating';

export default function ReviewForm({ onSubmit, initialValues, submitLabel = 'Submit Review', onCancel }) {
  const [rating, setRating] = useState(initialValues?.rating || 0);
  const [content, setContent] = useState(initialValues?.content || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating || !content.trim()) return;

    setLoading(true);
    setError('');
    try {
      await onSubmit({ rating, content });
      if (!initialValues) {
        setRating(0);
        setContent('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <StarRating value={rating} onChange={setRating} />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your review..."
        rows={3}
        maxLength={1000}
      />
      {error && <p className="error">{error}</p>}
      <div className="review-form-actions">
        <button type="submit" disabled={loading || !rating || !content.trim()}>
          {loading ? 'Submitting...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
