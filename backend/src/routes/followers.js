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

async function followUser(followerId, followingId) {
  await query(
    `INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)`,
    [followerId, followingId]
  );
}

export default router;
