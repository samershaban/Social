import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import Redis from 'ioredis';

const router = Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

function formatPost(row) {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
    },
  };
}

async function getPostsByUserId(userId) {
  const cachedPosts = await redis.get(`posts:${userId}`);
  if (cachedPosts) {
    // console.log('Returning cached posts', cachedPosts);
    // console.log('Cached posts for user:', userId, cachedPosts);
    console.log('Cache contains posts for user:', userId);
    return JSON.parse(cachedPosts);
  } else {
    console.log('Cache empty, no posts for user:', userId);
  }

  const posts = await query(
    `SELECT p.id, p.content, p.created_at, p.user_id, u.username
     FROM posts p
     JOIN users u ON u.id = p.user_id
     where u.id = $1`,
     [userId]
  );
  await redis.set(`posts:${userId}`, JSON.stringify(posts.rows.map(formatPost)), 'EX', 30);

  // console.log('Cached posts for user:', userId, JSON.stringify(posts.rows.map(formatPost)));
  return posts.rows.map(formatPost);
}

router.get('/', async (_req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.content, p.created_at, p.user_id, u.username
       FROM posts p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows.map(formatPost));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const posts = await getPostsByUserId(req.params.id);
    if(!posts) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'Post content is required' });
  }

  try {
    const result = await query(
      `INSERT INTO posts (user_id, content)
       VALUES ($1, $2)
       RETURNING id, content, created_at, user_id`,
      [req.userId, content.trim()]
    );

    const userResult = await query('SELECT username FROM users WHERE id = $1', [req.userId]);
    const row = { ...result.rows[0], username: userResult.rows[0].username };
    res.status(201).json(formatPost(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT user_id FROM posts WHERE id = $1', [req.params.id]);

    const post = result.rows[0];
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    await query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
