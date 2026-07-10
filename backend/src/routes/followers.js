import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// get all the followers of userId
async function getFollowers(userId) {
  const followers = await query(
    `SELECT * FROM followers WHERE following_id = $1`,
    [userId]
  );
  return followers.rows;
}

// See who userId is following. Need to fetch posts
async function getFollowing(userId) {
  const followers = await query(
    `SELECT * FROM followers WHERE follower_id = $1`,
    [userId]
  );
  return followers.rows;
}

async function userExists(userId) {
  const result = await query('SELECT id FROM users WHERE id = $1', [userId]);
  return result.rows[0] ?? null;
}

async function isFollowing(followerId, followingId) {
  const result = await query(
    `SELECT id FROM followers WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
  return result.rows.length > 0;
}

async function followUser(followerId, followingId) {
  await query(
    `INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)`,
    [followerId, followingId]
  );
}

async function unfollowUser(followerId, followingId) {
  const result = await query(
    `DELETE FROM followers WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
  return result.rowCount > 0;
}

router.get('/:id/following', async (req, res) => {
  try {
    const followers = await getFollowing(req.params.id);
    if (!followers) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(followers.map(f => f.following_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/follow/:id', requireAuth, async (req, res) => {
  try {
    const followingId = req.params.id;

    if (String(req.userId) === String(followingId)) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const user = await userExists(followingId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (await isFollowing(req.userId, followingId)) {
      return res.status(409).json({ error: 'Already following this user' });
    }

    await followUser(req.userId, followingId);
    res.status(201).json({ message: 'Now following user' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

router.delete('/follow/:id', requireAuth, async (req, res) => {
  try {
    const followingId = req.params.id;

    const unfollowed = await unfollowUser(req.userId, followingId);
    if (!unfollowed) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    res.json({ message: 'Unfollowed user' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

export default router;
