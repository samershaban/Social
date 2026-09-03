import { useState } from 'react';

export default function BusinessForm({ onSubmit, initialValues, submitLabel = 'Post Business' }) {
  const [name, setName] = useState(initialValues?.name || '');
  const [category, setCategory] = useState(initialValues?.category || '');
  const [address, setAddress] = useState(initialValues?.address || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      await onSubmit({ name, category, address, description });
      if (!initialValues) {
        setName('');
        setCategory('');
        setAddress('');
        setDescription('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="business-form" onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Business name"
        maxLength={120}
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category (optional)"
        maxLength={80}
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address (optional)"
        maxLength={255}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={3}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading || !name.trim()}>
        {loading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
