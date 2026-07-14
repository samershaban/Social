import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function formatMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    content: row.content,
    createdAt: row.created_at,
    senderId: row.sender_id,
    sender: {
      id: row.sender_id,
      username: row.username,
    },
  };
}

async function getOrCreateConversation(userId, otherUserId) {
  const userA = Math.min(userId, otherUserId);
  const userB = Math.max(userId, otherUserId);

  const result = await query(
    `INSERT INTO conversations (user_a, user_b)
     VALUES ($1, $2)
     ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = EXCLUDED.user_a
     RETURNING id, user_a, user_b, created_at`,
    [userA, userB]
  );

  return result.rows[0];
}

async function userInConversation(conversationId, userId) {
  const result = await query(
    `SELECT id, user_a, user_b FROM conversations
     WHERE id = $1 AND (user_a = $2 OR user_b = $2)`,
    [conversationId, userId]
  );
  return result.rows[0] ?? null;
}

async function getOtherUser(conversation, currentUserId) {
  const otherId = conversation.user_a === currentUserId
    ? conversation.user_b
    : conversation.user_a;

  const result = await query(
    'SELECT id, username FROM users WHERE id = $1',
    [otherId]
  );
  return result.rows[0] ?? null;
}

router.post('/', requireAuth, async (req, res) => {
  const otherUserId = Number(req.body.userId);

  if (!otherUserId || Number.isNaN(otherUserId)) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (otherUserId === req.userId) {
    return res.status(400).json({ error: 'Cannot chat with yourself' });
  }

  try {
    const otherUser = await query(
      'SELECT id, username FROM users WHERE id = $1',
      [otherUserId]
    );
    if (!otherUser.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const conversation = await getOrCreateConversation(req.userId, otherUserId);
    res.json({
      id: conversation.id,
      otherUser: otherUser.rows[0],
      createdAt: conversation.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.created_at, c.user_a, c.user_b,
              u.id AS other_id, u.username AS other_username,
              (
                SELECT m.content FROM messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message,
              (
                SELECT m.created_at FROM messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message_at
       FROM conversations c
       JOIN users u ON u.id = CASE
         WHEN c.user_a = $1 THEN c.user_b
         ELSE c.user_a
       END
       WHERE c.user_a = $1 OR c.user_b = $1
       ORDER BY COALESCE(
         (SELECT m.created_at FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC LIMIT 1),
         c.created_at
       ) DESC`,
      [req.userId]
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        otherUser: { id: row.other_id, username: row.other_username },
        lastMessage: row.last_message || null,
        lastMessageAt: row.last_message_at || null,
        createdAt: row.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const conversation = await userInConversation(req.params.id, req.userId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, u.username
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );

    const otherUser = await getOtherUser(conversation, req.userId);
    res.json({
      conversationId: conversation.id,
      otherUser,
      messages: result.rows.map(formatMessage),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export { formatMessage, userInConversation };
export default router;
