const STAR_VALUES = [1, 2, 3, 4, 5];

export default function StarRating({ value = 0, onChange, readOnly = false }) {
  if (readOnly) {
    const rounded = Math.round(value * 2) / 2;
    return (
      <div className="star-rating" aria-label={`${rounded} out of 5 stars`}>
        {STAR_VALUES.map((n) => {
          if (rounded >= n) return <span key={n} className="star star-filled">★</span>;
          if (rounded >= n - 0.5) {
            return (
              <span key={n} className="star star-half">
                <span className="star-half-fill">★</span>★
              </span>
            );
          }
          return <span key={n} className="star">★</span>;
        })}
      </div>
    );
  }

  return (
    <div className="star-rating interactive" role="radiogroup" aria-label="Rating">
      {STAR_VALUES.map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? 'star star-filled' : 'star'}
          aria-checked={n === value}
          role="radio"
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
