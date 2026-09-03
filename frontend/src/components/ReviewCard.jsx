import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StarRating from './StarRating';
import ReviewForm from './ReviewForm';

export default function ReviewCard({ review, onUpdate, onDelete }) {
  const { user } = useAuth();
  const isOwner = user?.id === review.author.id;
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ReviewForm
        initialValues={{ rating: review.rating, content: review.content }}
        submitLabel="Save"
        onCancel={() => setEditing(false)}
        onSubmit={async (body) => {
          await onUpdate(review.id, body);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <article className="review-card">
      <header className="review-header">
        <Link to={`/users/${review.author.id}`} className="post-author">
          @{review.author.username}
        </Link>
        <StarRating value={review.rating} readOnly />
        <time dateTime={review.createdAt}>
          {new Date(review.createdAt).toLocaleString()}
        </time>
      </header>
      <p className="review-content">{review.content}</p>
      {isOwner && (
        <div className="review-actions">
          <button type="button" className="btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="btn-danger btn-sm" onClick={() => onDelete(review.id)}>
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
