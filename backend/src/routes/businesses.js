import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const reviewsRouter = Router();

const BUSINESS_SELECT = `
  SELECT b.id, b.name, b.category, b.description, b.address, b.created_at, b.user_id, u.username,
         AVG(r.rating)::float AS avg_rating, COUNT(r.id)::int AS review_count
  FROM businesses b
  JOIN users u ON u.id = b.user_id
  LEFT JOIN reviews r ON r.business_id = b.id
`;

function formatBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category || '',
    description: row.description || '',
    address: row.address || '',
    createdAt: row.created_at,
    owner: { id: row.user_id, username: row.username },
    avgRating: row.avg_rating !== null ? Number(row.avg_rating) : null,
    reviewCount: Number(row.review_count),
  };
}

function formatReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    content: row.content,
    createdAt: row.created_at,
    author: { id: row.user_id, username: row.username },
    businessId: row.business_id,
  };
}

async function getBusiness(id) {
  const result = await query(
    `${BUSINESS_SELECT} WHERE b.id = $1 GROUP BY b.id, u.username`,
    [id]
  );
  return result.rows[0] ?? null;
}

async function hasReviewed(userId, businessId) {
  const result = await query(
    `SELECT id FROM reviews WHERE user_id = $1 AND business_id = $2`,
    [userId, businessId]
  );
  return result.rows.length > 0;
}

router.get('/', async (_req, res) => {
  try {
    const result = await query(
      `${BUSINESS_SELECT} GROUP BY b.id, u.username ORDER BY b.created_at DESC`
    );
    res.json(result.rows.map(formatBusiness));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

router.get('/search', async (req, res) => {
  const { q } = req.query;

  if (!q?.trim()) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const result = await query(
      `${BUSINESS_SELECT}
       WHERE b.name ILIKE $1 OR b.category ILIKE $1 OR b.description ILIKE $1
       GROUP BY b.id, u.username
       ORDER BY b.created_at DESC`,
      [`%${q.trim()}%`]
    );
    res.json(result.rows.map(formatBusiness));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search businesses' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const business = await getBusiness(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    res.json(formatBusiness(business));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, category, description, address } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Business name is required' });
  }

  try {
    const result = await query(
      `INSERT INTO businesses (user_id, name, category, description, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, category, description, address, created_at, user_id`,
      [req.userId, name.trim(), category?.trim() || '', description?.trim() || '', address?.trim() || '']
    );

    const userResult = await query('SELECT username FROM users WHERE id = $1', [req.userId]);
    const row = { ...result.rows[0], username: userResult.rows[0].username, avg_rating: null, review_count: 0 };
    res.status(201).json(formatBusiness(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, category, description, address } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Business name is required' });
  }

  try {
    const result = await query('SELECT user_id FROM businesses WHERE id = $1', [req.params.id]);
    const business = result.rows[0];
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    if (business.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own businesses' });
    }

    await query(
      `UPDATE businesses SET name = $1, category = $2, description = $3, address = $4 WHERE id = $5`,
      [name.trim(), category?.trim() || '', description?.trim() || '', address?.trim() || '', req.params.id]
    );

    const updated = await getBusiness(req.params.id);
    res.json(formatBusiness(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT user_id FROM businesses WHERE id = $1', [req.params.id]);
    const business = result.rows[0];
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    if (business.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own businesses' });
    }

    await query('DELETE FROM businesses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Business deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete business' });
  }
});

router.get('/:id/reviews', async (req, res) => {
  try {
    const business = await getBusiness(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const result = await query(
      `SELECT rv.id, rv.rating, rv.content, rv.created_at, rv.user_id, rv.business_id, u.username
       FROM reviews rv
       JOIN users u ON u.id = rv.user_id
       WHERE rv.business_id = $1
       ORDER BY rv.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows.map(formatReview));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post('/:id/reviews', requireAuth, async (req, res) => {
  const businessId = req.params.id;
  const rating = Number(req.body.rating);
  const { content } = req.body;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Review content is required' });
  }

  try {
    const business = await getBusiness(businessId);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    if (business.user_id === req.userId) {
      return res.status(403).json({ error: 'You cannot review your own business' });
    }
    if (await hasReviewed(req.userId, businessId)) {
      return res.status(409).json({ error: 'You have already reviewed this business' });
    }

    const result = await query(
      `INSERT INTO reviews (user_id, business_id, rating, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, content, created_at, user_id, business_id`,
      [req.userId, businessId, rating, content.trim()]
    );

    const userResult = await query('SELECT username FROM users WHERE id = $1', [req.userId]);
    const row = { ...result.rows[0], username: userResult.rows[0].username };
    res.status(201).json(formatReview(row));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already reviewed this business' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

reviewsRouter.put('/:id', requireAuth, async (req, res) => {
  const rating = Number(req.body.rating);
  const { content } = req.body;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Review content is required' });
  }

  try {
    const result = await query('SELECT user_id FROM reviews WHERE id = $1', [req.params.id]);
    const review = result.rows[0];
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own reviews' });
    }

    const updateResult = await query(
      `UPDATE reviews SET rating = $1, content = $2 WHERE id = $3
       RETURNING id, rating, content, created_at, user_id, business_id`,
      [rating, content.trim(), req.params.id]
    );

    const userResult = await query('SELECT username FROM users WHERE id = $1', [req.userId]);
    const row = { ...updateResult.rows[0], username: userResult.rows[0].username };
    res.json(formatReview(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

reviewsRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT user_id FROM reviews WHERE id = $1', [req.params.id]);
    const review = result.rows[0];
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own reviews' });
    }

    await query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export { reviewsRouter };
export default router;
