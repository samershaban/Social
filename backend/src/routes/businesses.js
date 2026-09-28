import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const reviewsRouter = Router();

const BUSINESS_SELECT = `
  SELECT b.id, b.name, b.category, b.description, b.address, b.created_at, b.user_id,
         b.review_count, b.rating_total, u.username
  FROM businesses b
  JOIN users u ON u.id = b.user_id
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
    avgRating: row.review_count > 0 ? row.rating_total / row.review_count : null,
    reviewCount: row.review_count,
  };
}

function formatReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title || '',
    content: row.content,
    createdAt: row.created_at,
    author: { id: row.user_id, username: row.username },
    businessId: row.business_id,
  };
}

async function getBusiness(id) {
  const result = await query(`${BUSINESS_SELECT} WHERE b.id = $1`, [id]);
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
      `${BUSINESS_SELECT} ORDER BY b.created_at DESC`
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
       RETURNING id, name, category, description, address, created_at, user_id, review_count, rating_total`,
      [req.userId, name.trim(), category?.trim() || '', description?.trim() || '', address?.trim() || '']
    );

    const userResult = await query('SELECT username FROM users WHERE id = $1', [req.userId]);
    const row = { ...result.rows[0], username: userResult.rows[0].username };
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
      `SELECT rv.id, rv.rating, rv.title, rv.content, rv.created_at, rv.user_id, rv.business_id, u.username
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
  const { title, content } = req.body;

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
      `WITH inserted AS (
         INSERT INTO reviews (user_id, business_id, rating, title, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, rating, title, content, created_at, user_id, business_id
       ), business_update AS (
         UPDATE businesses
         SET review_count = review_count + 1, rating_total = rating_total + (SELECT rating FROM inserted)
         WHERE id = (SELECT business_id FROM inserted)
         RETURNING id
       )
       SELECT * FROM inserted`,
      [req.userId, businessId, rating, title?.trim() || '', content.trim()]
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
  const { title, content } = req.body;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Review content is required' });
  }

  try {
    const result = await query('SELECT user_id, rating, business_id FROM reviews WHERE id = $1', [req.params.id]);
    const review = result.rows[0];
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own reviews' });
    }

    const ratingDelta = rating - review.rating;
    const updateResult = await query(
      `WITH updated_review AS (
         UPDATE reviews SET rating = $1, title = $2, content = $3 WHERE id = $4
         RETURNING id, rating, title, content, created_at, user_id, business_id
       ), business_update AS (
         UPDATE businesses SET rating_total = rating_total + $5 WHERE id = $6
         RETURNING id
       )
       SELECT * FROM updated_review`,
      [rating, title?.trim() || '', content.trim(), req.params.id, ratingDelta, review.business_id]
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
    const result = await query('SELECT user_id, rating, business_id FROM reviews WHERE id = $1', [req.params.id]);
    const review = result.rows[0];
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own reviews' });
    }

    await query(
      `WITH deleted AS (
         DELETE FROM reviews WHERE id = $1
         RETURNING id
       )
       UPDATE businesses SET review_count = review_count - 1, rating_total = rating_total - $2 WHERE id = $3`,
      [req.params.id, review.rating, review.business_id]
    );
    res.json({ message: 'Review deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export { reviewsRouter };
export default router;
