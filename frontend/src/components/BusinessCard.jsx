import { Link } from 'react-router-dom';
import StarRating from './StarRating';

export default function BusinessCard({ business }) {
  return (
    <Link to={`/businesses/${business.id}`} className="business-card">
      <h3>{business.name}</h3>
      {business.category && <span className="business-category">{business.category}</span>}
      <div className="business-rating-summary">
        <StarRating value={business.avgRating || 0} readOnly />
        <span>
          {business.reviewCount} review{business.reviewCount !== 1 ? 's' : ''}
        </span>
      </div>
      {business.address && <p className="business-address">{business.address}</p>}
    </Link>
  );
}
