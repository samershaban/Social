import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import BusinessForm from '../components/BusinessForm';
import ReviewForm from '../components/ReviewForm';
import ReviewCard from '../components/ReviewCard';

export default function BusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getBusiness(id), api.getReviews(id)])
      .then(([businessData, reviewsData]) => {
        setBusiness(businessData);
        setReviews(reviewsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function refreshBusiness() {
    const updated = await api.getBusiness(id);
    setBusiness(updated);
  }

  async function handleUpdateBusiness(body) {
    const updated = await api.updateBusiness(id, body);
    setBusiness(updated);
    setEditing(false);
  }

  async function handleDeleteBusiness() {
    await api.deleteBusiness(id);
    navigate('/businesses');
  }

  async function handleCreateReview(body) {
    const review = await api.createReview(id, body);
    setReviews((prev) => [review, ...prev]);
    await refreshBusiness();
  }

  async function handleUpdateReview(reviewId, body) {
    const updated = await api.updateReview(reviewId, body);
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? updated : r)));
    await refreshBusiness();
  }

  async function handleDeleteReview(reviewId) {
    await api.deleteReview(reviewId);
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    await refreshBusiness();
  }

  if (loading) return <p className="loading">Loading business...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!business) return <p className="error">Business not found</p>;

  const isOwner = user?.id === business.owner.id;
  const alreadyReviewed = user && reviews.some((r) => r.author.id === user.id);

  return (
    <div className="business-detail-page">
      <header className="business-detail-header">
        {editing ? (
          <BusinessForm initialValues={business} submitLabel="Save" onSubmit={handleUpdateBusiness} />
        ) : (
          <>
            <h1>{business.name}</h1>
            {business.category && <span className="business-category">{business.category}</span>}
            <div className="business-detail-meta">
              <StarRating value={business.avgRating || 0} readOnly />
              <span>
                {business.reviewCount} review{business.reviewCount !== 1 ? 's' : ''}
              </span>
            </div>
            {business.address && <p className="business-address">{business.address}</p>}
            {business.description && (
              <p className="business-detail-description">{business.description}</p>
            )}
            {isOwner && (
              <div className="business-detail-actions">
                <button type="button" className="btn-sm" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button type="button" className="btn-danger btn-sm" onClick={handleDeleteBusiness}>
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </header>

      <h2>Reviews</h2>
      {user && !isOwner && !alreadyReviewed && <ReviewForm onSubmit={handleCreateReview} />}
      {isOwner && <p className="empty">You can't review your own business.</p>}
      {alreadyReviewed && !isOwner && (
        <p className="empty">You've already reviewed this business.</p>
      )}
      {reviews.length === 0 ? (
        <p className="empty">No reviews yet.</p>
      ) : (
        <div className="review-list">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onUpdate={handleUpdateReview}
              onDelete={handleDeleteReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
