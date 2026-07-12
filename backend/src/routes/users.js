import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function getUserProfile(userId) {
  const userResult = await query(
    `SELECT u.id, u.username, u.email, u.bio, u.created_at,
            COUNT(p.id)::int AS post_count
     FROM users u
     LEFT JOIN posts p ON p.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
  

  const user = userResult.rows[0];
  if (!user) return null;

  const postsResult = await query(
    `SELECT p.id, p.content, p.created_at, p.user_id, u.username
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio || '',
    createdAt: user.created_at,
    postCount: user.post_count,
    posts: postsResult.rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      author: { id: row.user_id, username: row.username },
    })),
  };
}

async function searchUsers(keyword, limit = 20) {
  const result = await query(
    `SELECT id, username, bio
     FROM users
     WHERE username ILIKE $1
     ORDER BY username
     LIMIT $2`,
    [`%${keyword}%`, limit]
  );

  return result.rows.map((user) => ({
    id: user.id,
    username: user.username,
    bio: user.bio || '',
  }));
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/me', requireAuth, async (req, res) => {
  const { bio } = req.body;

  if (bio === undefined) {
    return res.status(400).json({ error: 'Bio is required' });
  }

  try {
    await query('UPDATE users SET bio = $1 WHERE id = $2', [bio, req.userId]);
    const profile = await getUserProfile(req.userId);
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/search', async (req, res) => {
  const { q, limit } = req.query;

  if (!q?.trim()) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const users = await searchUsers(q.trim(), limit ? Number(limit) : 20);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const profile = await getUserProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { email, ...publicProfile } = profile;
    res.json(publicProfile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
